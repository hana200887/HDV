namespace OrderService.Infrastructure;

public sealed class ServiceDiscoveryOptions
{
    public string ServiceName { get; set; } = "order-service";
    public string ServiceAddress { get; set; } = "orderservice";
    public int ServicePort { get; set; } = 8080;
    public string? ServiceId { get; set; }
}