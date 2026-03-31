namespace MenuService.Infrastructure;

public sealed class ServiceDiscoveryOptions
{
    public string ServiceName { get; set; } = "menu-service";
    public string ServiceAddress { get; set; } = "menuservice";
    public int ServicePort { get; set; } = 8080;
    public string? ServiceId { get; set; }
}