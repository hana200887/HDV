namespace OrderService.Models;

public sealed class OrderResponse
{
    public Guid Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public decimal TotalAmount { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public List<OrderItemResponse> Items { get; set; } = new();

    public static OrderResponse FromEntity(OrderEntity entity)
    {
        return new OrderResponse
        {
            Id = entity.Id,
            Username = entity.Username,
            TotalAmount = entity.TotalAmount,
            Status = entity.Status,
            CreatedAt = entity.CreatedAt,
            Items = entity.Items.Select(x => new OrderItemResponse
            {
                MenuItemId = x.MenuItemId,
                Name = x.Name,
                Quantity = x.Quantity,
                UnitPrice = x.UnitPrice
            }).ToList()
        };
    }
}

public sealed class OrderItemResponse
{
    public Guid MenuItemId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
}