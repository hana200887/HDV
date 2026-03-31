namespace OrderService.Models;

public sealed class OrderEntity
{
    public Guid Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public decimal TotalAmount { get; set; }
    public string Status { get; set; } = OrderStatus.PendingPayment;
    public DateTimeOffset CreatedAt { get; set; }
    public List<OrderItemEntity> Items { get; set; } = new();
}