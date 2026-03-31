namespace SharedContracts.Events;

public sealed class OrderCreatedEvent
{
    public Guid OrderId { get; set; }
    public string Username { get; set; } = string.Empty;
    public decimal TotalAmount { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public List<OrderItemPayload> Items { get; set; } = new();
}