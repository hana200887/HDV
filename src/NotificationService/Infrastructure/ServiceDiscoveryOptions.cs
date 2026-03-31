namespace NotificationService.Infrastructure;

public sealed class ServiceDiscoveryOptions
{
    public string ServiceName { get; set; } = "notification-service";
    public string ServiceAddress { get; set; } = "notificationservice";
    public int ServicePort { get; set; } = 8080;
    public string? ServiceId { get; set; }
}