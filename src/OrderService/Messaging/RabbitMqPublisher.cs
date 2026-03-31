using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using OrderService.Infrastructure;
using RabbitMQ.Client;
using SharedContracts.Events;

namespace OrderService.Messaging;

public sealed class RabbitMqPublisher
{
    private readonly RabbitMqOptions _options;
    private readonly ILogger<RabbitMqPublisher> _logger;

    public RabbitMqPublisher(IOptions<RabbitMqOptions> options, ILogger<RabbitMqPublisher> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public async Task PublishOrderCreatedAsync(OrderCreatedEvent message, CancellationToken cancellationToken)
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
                    routingKey: "order.created",
                    basicProperties: properties,
                    body: body);

                return;
            }
            catch (Exception ex) when (attempt < 5)
            {
                _logger.LogWarning(ex, "Publish order.created failed (attempt {Attempt}/5). Retrying...", attempt);
                await Task.Delay(TimeSpan.FromSeconds(2), cancellationToken);
            }
        }
    }
}
