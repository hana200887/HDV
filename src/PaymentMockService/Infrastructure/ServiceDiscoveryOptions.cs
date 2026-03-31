namespace PaymentMockService.Infrastructure;

public sealed class ServiceDiscoveryOptions
{
    public string ServiceName { get; set; } = "payment-service";
    public string ServiceAddress { get; set; } = "paymentmockservice";
    public int ServicePort { get; set; } = 8080;
    public string? ServiceId { get; set; }
}