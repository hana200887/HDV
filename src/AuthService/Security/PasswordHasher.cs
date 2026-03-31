using System.Security.Cryptography;
using System.Text;

namespace AuthService.Security;

public static class PasswordHasher
{
    public static string Hash(string value)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(value));
        return Convert.ToHexString(bytes);
    }
}