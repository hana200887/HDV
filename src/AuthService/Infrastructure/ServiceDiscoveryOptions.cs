namespace AuthService.Infrastructure;

public sealed class ServiceDiscoveryOptions
{
    public string ServiceName { get; set; } = "auth-service";
    public string ServiceAddress { get; set; } = "authservice";
    public int ServicePort { get; set; } = 8080;
    public string? ServiceId { get; set; }
}