using System.Text;
using System.Text.Json;
using Consul;
using MenuService.Data;
using MenuService.Infrastructure;
using MenuService.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Serilog;
using Serilog.Sinks.Elasticsearch;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, loggerConfiguration) =>
{
    var elasticUri = context.Configuration["Serilog:ElasticUri"] ?? "http://localhost:9200";

    loggerConfiguration
        .Enrich.FromLogContext()
        .Enrich.WithProperty("Service", "MenuService")
        .WriteTo.Console()
        .WriteTo.Elasticsearch(new ElasticsearchSinkOptions(new Uri(elasticUri))
        {
            AutoRegisterTemplate = true,
            IndexFormat = "menuservice-logs-{0:yyyy.MM}"
        });
});

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection("Jwt"));
builder.Services.Configure<ServiceDiscoveryOptions>(builder.Configuration.GetSection("ServiceDiscovery"));

builder.Services.AddSingleton<IConsulClient>(_ => new ConsulClient(config =>
{
    config.Address = new Uri(builder.Configuration["Consul:Address"] ?? "http://localhost:8500");
}));
builder.Services.AddHostedService<ConsulRegistrationHostedService>();

builder.Services.AddDbContext<MenuDbContext>(options =>
{
    var connectionString = builder.Configuration.GetConnectionString("Postgres")
                           ?? "Host=localhost;Port=5432;Database=menu_db;Username=postgres;Password=postgres";
    options.UseNpgsql(connectionString);
});

builder.Services.AddSingleton<IConnectionMultiplexer>(_ =>
{
    var redisConnectionString = builder.Configuration["Redis:ConnectionString"] ?? "localhost:6379";
    var redisConfiguration = ConfigurationOptions.Parse(redisConnectionString);
    redisConfiguration.AbortOnConnectFail = false;
    return ConnectionMultiplexer.Connect(redisConfiguration);
});

var jwtOptions = builder.Configuration.GetSection("Jwt").Get<JwtOptions>() ?? new JwtOptions();
var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.Key));

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidAudience = jwtOptions.Audience,
            IssuerSigningKey = key
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHealthChecks();

builder.Services
    .AddOpenTelemetry()
    .WithTracing(tracerProviderBuilder =>
    {
        tracerProviderBuilder
            .SetResourceBuilder(ResourceBuilder.CreateDefault().AddService("MenuService"))
            .AddAspNetCoreInstrumentation()
            .AddHttpClientInstrumentation()
            .AddZipkinExporter(zipkinOptions =>
            {
                zipkinOptions.Endpoint = new Uri(builder.Configuration["OpenTelemetry:ZipkinEndpoint"] ?? "http://zipkin:9411/api/v2/spans");
            });
    });

var app = builder.Build();

await EnsureMenuDatabaseReadyAsync(app.Services, app.Logger);

app.UseSerilogRequestLogging();
app.UseSwagger();
app.UseSwaggerUI();

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "Healthy" }));

app.MapGet("/menu", async (MenuDbContext dbContext, IConnectionMultiplexer multiplexer, CancellationToken cancellationToken) =>
{
    const string cacheKey = "menu:all";
    var db = multiplexer.GetDatabase();

    var cached = await db.StringGetAsync(cacheKey);
    if (cached.HasValue)
    {
        var cachedItems = JsonSerializer.Deserialize<List<MenuItemDto>>(cached.ToString()) ?? new List<MenuItemDto>();
        return Results.Ok(new { source = "cache", data = cachedItems });
    }

    var items = await dbContext.MenuItems
        .OrderBy(x => x.Name)
        .Select(x => new MenuItemDto
        {
            Id = x.Id,
            Name = x.Name,
            Description = x.Description,
            Price = x.Price
        })
        .ToListAsync(cancellationToken);

    await db.StringSetAsync(cacheKey, JsonSerializer.Serialize(items), TimeSpan.FromMinutes(5));

    return Results.Ok(new { source = "database", data = items });
});

app.MapPost("/menu", [Authorize(Roles = "admin")] async ([FromBody] CreateMenuItemRequest request, MenuDbContext dbContext, IConnectionMultiplexer multiplexer, CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.Name) || request.Price <= 0)
    {
        return Results.BadRequest(new { message = "Name and positive price are required." });
    }

    var entity = new MenuItemEntity
    {
        Id = Guid.NewGuid(),
        Name = request.Name.Trim(),
        Description = request.Description?.Trim(),
        Price = request.Price,
        CreatedAt = DateTimeOffset.UtcNow
    };

    dbContext.MenuItems.Add(entity);
    await dbContext.SaveChangesAsync(cancellationToken);

    await multiplexer.GetDatabase().KeyDeleteAsync("menu:all");

    return Results.Created($"/menu/{entity.Id}", new MenuItemDto
    {
        Id = entity.Id,
        Name = entity.Name,
        Description = entity.Description,
        Price = entity.Price
    });
});

app.Run();

static async Task EnsureMenuDatabaseReadyAsync(IServiceProvider services, ILogger logger)
{
    using var scope = services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<MenuDbContext>();

    for (var attempt = 1; attempt <= 15; attempt++)
    {
        try
        {
            await dbContext.Database.EnsureCreatedAsync();
            logger.LogInformation("Menu database is ready.");
            return;
        }
        catch (Exception ex) when (attempt < 15)
        {
            logger.LogWarning(ex, "Menu database not ready (attempt {Attempt}/15). Retrying...", attempt);
            await Task.Delay(TimeSpan.FromSeconds(2));
        }
    }
}
