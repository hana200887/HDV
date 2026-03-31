using System.Collections.Concurrent;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using AuthService.Infrastructure;
using AuthService.Models;
using AuthService.Security;
using Consul;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Serilog;
using Serilog.Sinks.Elasticsearch;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, loggerConfiguration) =>
{
    var elasticUri = context.Configuration["Serilog:ElasticUri"] ?? "http://localhost:9200";

    loggerConfiguration
        .Enrich.FromLogContext()
        .Enrich.WithProperty("Service", "AuthService")
        .WriteTo.Console()
        .WriteTo.Elasticsearch(new ElasticsearchSinkOptions(new Uri(elasticUri))
        {
            AutoRegisterTemplate = true,
            IndexFormat = "authservice-logs-{0:yyyy.MM}"
        });
});

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection("Jwt"));
builder.Services.Configure<ServiceDiscoveryOptions>(builder.Configuration.GetSection("ServiceDiscovery"));

builder.Services.AddSingleton<ConcurrentDictionary<string, UserRecord>>();
builder.Services.AddSingleton<IConsulClient>(_ => new ConsulClient(config =>
{
    config.Address = new Uri(builder.Configuration["Consul:Address"] ?? "http://localhost:8500");
}));
builder.Services.AddHostedService<ConsulRegistrationHostedService>();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHealthChecks();

builder.Services
    .AddOpenTelemetry()
    .WithTracing(tracerProviderBuilder =>
    {
        tracerProviderBuilder
            .SetResourceBuilder(ResourceBuilder.CreateDefault().AddService("AuthService"))
            .AddAspNetCoreInstrumentation()
            .AddHttpClientInstrumentation()
            .AddZipkinExporter(zipkinOptions =>
            {
                zipkinOptions.Endpoint = new Uri(builder.Configuration["OpenTelemetry:ZipkinEndpoint"] ?? "http://zipkin:9411/api/v2/spans");
            });
    });

var app = builder.Build();

app.UseSerilogRequestLogging();
app.UseSwagger();
app.UseSwaggerUI();

app.MapGet("/health", () => Results.Ok(new { status = "Healthy" }));

var users = app.Services.GetRequiredService<ConcurrentDictionary<string, UserRecord>>();
var adminUsername = (app.Configuration["Auth:AdminUsername"] ?? "admin").Trim().ToLowerInvariant();
var adminPassword = app.Configuration["Auth:AdminPassword"] ?? "admin123";

users.TryAdd(adminUsername, new UserRecord
{
    Username = adminUsername,
    PasswordHash = PasswordHasher.Hash(adminPassword),
    Role = "admin"
});

app.MapPost("/auth/register", ([FromBody] RegisterRequest request) =>
{
    if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
    {
        return Results.BadRequest(new { message = "Username and password are required." });
    }

    var normalized = request.Username.Trim().ToLowerInvariant();
    if (users.ContainsKey(normalized))
    {
        return Results.Conflict(new { message = "Username already exists." });
    }

    var user = new UserRecord
    {
        Username = normalized,
        PasswordHash = PasswordHasher.Hash(request.Password),
        Role = string.IsNullOrWhiteSpace(request.Role) ? "user" : request.Role.Trim().ToLowerInvariant()
    };

    users[normalized] = user;
    return Results.Ok(new { message = "Registered successfully." });
});

app.MapPost("/auth/login", ([FromBody] LoginRequest request, IOptions<JwtOptions> jwtOptionsAccessor) =>
{
    if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
    {
        return Results.BadRequest(new { message = "Username and password are required." });
    }

    var normalized = request.Username.Trim().ToLowerInvariant();
    if (!users.TryGetValue(normalized, out var user))
    {
        return Results.Unauthorized();
    }

    var incomingHash = PasswordHasher.Hash(request.Password);
    if (!string.Equals(incomingHash, user.PasswordHash, StringComparison.Ordinal))
    {
        return Results.Unauthorized();
    }

    var jwtOptions = jwtOptionsAccessor.Value;
    var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.Key));
    var credentials = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);

    var claims = new List<Claim>
    {
        new(JwtRegisteredClaimNames.Sub, user.Username),
        new(JwtRegisteredClaimNames.UniqueName, user.Username),
        new(ClaimTypes.Role, user.Role)
    };

    var expiresAt = DateTime.UtcNow.AddHours(8);

    var token = new JwtSecurityToken(
        issuer: jwtOptions.Issuer,
        audience: jwtOptions.Audience,
        claims: claims,
        expires: expiresAt,
        signingCredentials: credentials);

    var tokenValue = new JwtSecurityTokenHandler().WriteToken(token);

    return Results.Ok(new TokenResponse
    {
        AccessToken = tokenValue,
        ExpiresAtUtc = expiresAt
    });
});

app.Run();
