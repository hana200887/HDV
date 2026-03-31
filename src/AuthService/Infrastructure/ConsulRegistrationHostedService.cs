using Consul;
using Microsoft.Extensions.Options;

namespace AuthService.Infrastructure;

public sealed class ConsulRegistrationHostedService : IHostedService
{
    private readonly IConsulClient _consulClient;
    private readonly ServiceDiscoveryOptions _options;
    private readonly ILogger<ConsulRegistrationHostedService> _logger;
    private string? _serviceId;

    public ConsulRegistrationHostedService(
        IConsulClient consulClient,
        IOptions<ServiceDiscoveryOptions> options,
        ILogger<ConsulRegistrationHostedService> logger)
    {
        _consulClient = consulClient;
        _options = options.Value;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        _serviceId = string.IsNullOrWhiteSpace(_options.ServiceId)
            ? $"{_options.ServiceName}-{Guid.NewGuid():N}"
            : _options.ServiceId;

        var registration = new AgentServiceRegistration
        {
            ID = _serviceId,
            Name = _options.ServiceName,
            Address = _options.ServiceAddress,
            Port = _options.ServicePort,
            Check = new AgentServiceCheck
            {
                HTTP = $"http://{_options.ServiceAddress}:{_options.ServicePort}/health",
                Interval = TimeSpan.FromSeconds(10),
                Timeout = TimeSpan.FromSeconds(5),
                DeregisterCriticalServiceAfter = TimeSpan.FromMinutes(1)
            }
        };

        var registered = false;
        for (var attempt = 1; attempt <= 10 && !cancellationToken.IsCancellationRequested; attempt++)
        {
            try
            {
                await _consulClient.Agent.ServiceRegister(registration, cancellationToken);
                registered = true;
                _logger.LogInformation("Registered {ServiceName} with Consul.", _options.ServiceName);
                break;
            }
            catch (Exception ex) when (attempt < 10)
            {
                _logger.LogWarning(ex, "Consul registration failed (attempt {Attempt}/10) for {ServiceName}. Retrying...", attempt, _options.ServiceName);
                await Task.Delay(TimeSpan.FromSeconds(2), cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Consul registration failed for {ServiceName}.", _options.ServiceName);
            }
        }

        if (!registered)
        {
            _logger.LogWarning("Continuing without Consul registration for {ServiceName}.", _options.ServiceName);
        }
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(_serviceId))
        {
            return;
        }

        try
        {
            await _consulClient.Agent.ServiceDeregister(_serviceId, cancellationToken);
            _logger.LogInformation("Deregistered {ServiceId} from Consul.", _serviceId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to deregister {ServiceId} from Consul.", _serviceId);
        }
    }
}