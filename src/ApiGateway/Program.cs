using Ocelot.DependencyInjection;
using Ocelot.Middleware;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Serilog;
using Serilog.Sinks.Elasticsearch;

var builder = WebApplication.CreateBuilder(args);

builder.Configuration
    .SetBasePath(builder.Environment.ContentRootPath)
    .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
    .AddJsonFile("ocelot.json", optional: false, reloadOnChange: true)
    .AddEnvironmentVariables();

builder.Host.UseSerilog((context, loggerConfiguration) =>
{
    var elasticUri = context.Configuration["Serilog:ElasticUri"] ?? "http://localhost:9200";

    loggerConfiguration
        .Enrich.FromLogContext()
        .Enrich.WithProperty("Service", "ApiGateway")
        .WriteTo.Console()
        .WriteTo.Elasticsearch(new ElasticsearchSinkOptions(new Uri(elasticUri))
        {
            AutoRegisterTemplate = true,
            IndexFormat = "apigateway-logs-{0:yyyy.MM}"
        });
});

builder.Services.AddHealthChecks();

builder.Services
    .AddOpenTelemetry()
    .WithTracing(tracerProviderBuilder =>
    {
        tracerProviderBuilder
            .SetResourceBuilder(ResourceBuilder.CreateDefault().AddService("ApiGateway"))
            .AddAspNetCoreInstrumentation()
            .AddHttpClientInstrumentation()
            .AddZipkinExporter(zipkinOptions =>
            {
                zipkinOptions.Endpoint = new Uri(builder.Configuration["OpenTelemetry:ZipkinEndpoint"] ?? "http://zipkin:9411/api/v2/spans");
            });
    });

builder.Services.AddOcelot(builder.Configuration).AddConsul();

var app = builder.Build();

app.UseSerilogRequestLogging();

app.MapGet("/health", () => Results.Ok(new { status = "Healthy" }));

await app.UseOcelot();

app.Run();