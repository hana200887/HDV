using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Consul;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using OrderService.Data;
using OrderService.Infrastructure;
using OrderService.Messaging;
using OrderService.Models;
using Serilog;
using Serilog.Sinks.Elasticsearch;
using SharedContracts.Events;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, loggerConfiguration) =>
{
    var elasticUri = context.Configuration["Serilog:ElasticUri"] ?? "http://localhost:9200";

    loggerConfiguration
        .Enrich.FromLogContext()
        .Enrich.WithProperty("Service", "OrderService")
        .WriteTo.Console()
        .WriteTo.Elasticsearch(new ElasticsearchSinkOptions(new Uri(elasticUri))
        {
            AutoRegisterTemplate = true,
            IndexFormat = "orderservice-logs-{0:yyyy.MM}"
        });
});

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection("Jwt"));
builder.Services.Configure<RabbitMqOptions>(builder.Configuration.GetSection("RabbitMq"));
builder.Services.Configure<ServiceDiscoveryOptions>(builder.Configuration.GetSection("ServiceDiscovery"));

builder.Services.AddSingleton<IConsulClient>(_ => new ConsulClient(config =>
{
    config.Address = new Uri(builder.Configuration["Consul:Address"] ?? "http://localhost:8500");
}));
builder.Services.AddHostedService<ConsulRegistrationHostedService>();

builder.Services.AddDbContext<OrderDbContext>(options =>
{
    var connectionString = builder.Configuration.GetConnectionString("Postgres")
                           ?? "Host=localhost;Port=5432;Database=order_db;Username=postgres;Password=postgres";
    options.UseNpgsql(connectionString);
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

builder.Services.AddSingleton<RabbitMqPublisher>();
builder.Services.AddHostedService<PaymentResultConsumer>();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHealthChecks();

builder.Services
    .AddOpenTelemetry()
    .WithTracing(tracerProviderBuilder =>
    {
        tracerProviderBuilder
            .SetResourceBuilder(ResourceBuilder.CreateDefault().AddService("OrderService"))
            .AddAspNetCoreInstrumentation()
            .AddHttpClientInstrumentation()
            .AddZipkinExporter(zipkinOptions =>
            {
                zipkinOptions.Endpoint = new Uri(builder.Configuration["OpenTelemetry:ZipkinEndpoint"] ?? "http://zipkin:9411/api/v2/spans");
            });
    });

var app = builder.Build();

await EnsureOrderDatabaseReadyAsync(app.Services, app.Logger);

app.UseSerilogRequestLogging();
app.UseSwagger();
app.UseSwaggerUI();

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "Healthy" }));

var orderGroup = app.MapGroup("/orders").RequireAuthorization();

orderGroup.MapPost(string.Empty, async (
    PlaceOrderRequest request,
    ClaimsPrincipal user,
    OrderDbContext dbContext,
    RabbitMqPublisher publisher,
    CancellationToken cancellationToken) =>
{
    if (request.Items.Count == 0)
    {
        return Results.BadRequest(new { message = "At least one item is required." });
    }

    if (request.Items.Any(x => string.IsNullOrWhiteSpace(x.Name) || x.Quantity <= 0 || x.UnitPrice <= 0))
    {
        return Results.BadRequest(new { message = "Every item must have name, positive quantity and unit price." });
    }

    var username = user.FindFirstValue(JwtRegisteredClaimNames.Sub)
                   ?? user.FindFirstValue(JwtRegisteredClaimNames.UniqueName)
                   ?? "unknown";

    var order = new OrderEntity
    {
        Id = Guid.NewGuid(),
        Username = username,
        Status = OrderStatus.PendingPayment,
        CreatedAt = DateTimeOffset.UtcNow,
        TotalAmount = request.Items.Sum(x => x.Quantity * x.UnitPrice),
        Items = request.Items.Select(x => new OrderItemEntity
        {
            Id = Guid.NewGuid(),
            MenuItemId = x.MenuItemId,
            Name = x.Name.Trim(),
            Quantity = x.Quantity,
            UnitPrice = x.UnitPrice
        }).ToList()
    };

    dbContext.Orders.Add(order);
    await dbContext.SaveChangesAsync(cancellationToken);

    var evt = new OrderCreatedEvent
    {
        OrderId = order.Id,
        Username = order.Username,
        TotalAmount = order.TotalAmount,
        CreatedAt = order.CreatedAt,
        Items = order.Items.Select(x => new OrderItemPayload
        {
            MenuItemId = x.MenuItemId,
            Name = x.Name,
            Quantity = x.Quantity,
            UnitPrice = x.UnitPrice
        }).ToList()
    };

    await publisher.PublishOrderCreatedAsync(evt, cancellationToken);

    return Results.Created($"/orders/{order.Id}", OrderResponse.FromEntity(order));
});

orderGroup.MapGet("/{id:guid}", async (Guid id, ClaimsPrincipal user, OrderDbContext dbContext, CancellationToken cancellationToken) =>
{
    var username = user.FindFirstValue(JwtRegisteredClaimNames.Sub)
                   ?? user.FindFirstValue(JwtRegisteredClaimNames.UniqueName)
                   ?? "unknown";

    var order = await dbContext.Orders
        .Include(x => x.Items)
        .FirstOrDefaultAsync(x => x.Id == id && x.Username == username, cancellationToken);

    if (order is null)
    {
        return Results.NotFound();
    }

    return Results.Ok(OrderResponse.FromEntity(order));
});

app.Run();

static async Task EnsureOrderDatabaseReadyAsync(IServiceProvider services, ILogger logger)
{
    using var scope = services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<OrderDbContext>();

    for (var attempt = 1; attempt <= 15; attempt++)
    {
        try
        {
            await dbContext.Database.EnsureCreatedAsync();
            logger.LogInformation("Order database is ready.");
            return;
        }
        catch (Exception ex) when (attempt < 15)
        {
            logger.LogWarning(ex, "Order database not ready (attempt {Attempt}/15). Retrying...", attempt);
            await Task.Delay(TimeSpan.FromSeconds(2));
        }
    }
}
