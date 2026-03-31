namespace AuthService.Infrastructure;

public sealed class JwtOptions
{
    public string Issuer { get; set; } = "MiniFoodOrdering";
    public string Audience { get; set; } = "MiniFoodOrderingClient";
    public string Key { get; set; } = "super-secret-key-change-this";
}