namespace SharedContracts.Events;

public sealed class PaymentResultEvent
{
    public Guid OrderId { get; set; }
    public bool IsSuccess { get; set; }
    public string Message { get; set; } = string.Empty;
    public DateTimeOffset ProcessedAt { get; set; }
}