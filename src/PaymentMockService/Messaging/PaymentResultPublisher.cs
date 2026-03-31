using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using PaymentMockService.Infrastructure;
using RabbitMQ.Client;
using SharedContracts.Events;

namespace PaymentMockService.Messaging;

public sealed class PaymentResultPublisher
{
    private readonly RabbitMqOptions _options;
    private readonly ILogger<PaymentResultPublisher> _logger;

    public PaymentResultPublisher(IOptions<RabbitMqOptions> options, ILogger<PaymentResultPublisher> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public async Task PublishAsync(PaymentResultEvent message, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var payload = JsonSerializer.Serialize(message);
        var body = Encoding.UTF8.GetBytes(payload);

        for (var attempt = 1; attempt <= 5; attempt++)
        {
            try
            {
                var factory = new ConnectionFactory
                {
                    HostName = _options.HostName,
                    Port = _options.Port,
                    UserName = _options.UserName,
                    Password = _options.Password
                };

                using var connection = factory.CreateConnection();
                using var channel = connection.CreateModel();

                channel.ExchangeDeclare(
                    exchange: _options.ExchangeName,
                    type: ExchangeType.Topic,
                    durable: true,
                    autoDelete: false);

                var properties = channel.CreateBasicProperties();
                properties.Persistent = true;
                properties.ContentType = "application/json";

                channel.BasicPublish(
                    exchange: _options.ExchangeName,
                    routingKey: "payment.result",
                    basicProperties: properties,
                    body: body);

                return;
            }
            catch (Exception ex) when (attempt < 5)
            {
                _logger.LogWarning(ex, "Publish payment.result failed (attempt {Attempt}/5). Retrying...", attempt);
                await Task.Delay(TimeSpan.FromSeconds(2), cancellationToken);
            }
        }
    }
}
