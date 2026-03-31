namespace OrderService.Models;

public static class OrderStatus
{
    public const string PendingPayment = "PendingPayment";
    public const string Paid = "Paid";
    public const string PaymentFailed = "PaymentFailed";
}