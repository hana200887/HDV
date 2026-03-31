namespace MenuService.Models;

public sealed class MenuItemEntity
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}