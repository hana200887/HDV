using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using PaymentMockService.Infrastructure;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using SharedContracts.Events;

namespace PaymentMockService.Messaging;

public sealed class OrderCreatedConsumer : BackgroundService
{
    private readonly RabbitMqOptions _options;
    private readonly PaymentResultPublisher _publisher;
    private readonly ILogger<OrderCreatedConsumer> _logger;

    public OrderCreatedConsumer(
        IOptions<RabbitMqOptions> options,
        PaymentResultPublisher publisher,
        ILogger<OrderCreatedConsumer> logger)
    {
        _options = options.Value;
        _publisher = publisher;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            IConnection? connection = null;
            IModel? channel = null;

            try
            {
                var factory = new ConnectionFactory
                {
                    HostName = _options.HostName,
                    Port = _options.Port,
                    UserName = _options.UserName,
                    Password = _options.Password,
                    DispatchConsumersAsync = true
                };

                connection = factory.CreateConnection();
                channel = connection.CreateModel();

                channel.ExchangeDeclare(_options.ExchangeName, ExchangeType.Topic, durable: true, autoDelete: false);
                channel.QueueDeclare(
                    queue: "paymentmock.order.created",
                    durable: true,
                    exclusive: false,
                    autoDelete: false,
                    arguments: null);
                channel.QueueBind(
                    queue: "paymentmock.order.created",
                    exchange: _options.ExchangeName,
                    routingKey: "order.created");

                var consumer = new AsyncEventingBasicConsumer(channel);
                consumer.Received += async (_, ea) =>
                {
                    try
                    {
                        var json = Encoding.UTF8.GetString(ea.Body.ToArray());
                        var orderCreated = JsonSerializer.Deserialize<OrderCreatedEvent>(json);

                        if (orderCreated is null)
                        {
                            channel.BasicAck(ea.DeliveryTag, multiple: false);
                            return;
                        }

                        await Task.Delay(TimeSpan.FromMilliseconds(500), stoppingToken);

                        var paymentResult = new PaymentResultEvent
                        {
                            OrderId = orderCreated.OrderId,
                            IsSuccess = true,
                            Message = "Mock payment succeeded",
                            ProcessedAt = DateTimeOffset.UtcNow
                        };

                        await _publisher.PublishAsync(paymentResult, stoppingToken);

                        _logger.LogInformation(
                            "Payment processed for order {OrderId} with status {Status}",
                            orderCreated.OrderId,
                            paymentResult.IsSuccess);

                        channel.BasicAck(ea.DeliveryTag, multiple: false);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Failed to process order.created message");
                        channel.BasicNack(ea.DeliveryTag, multiple: false, requeue: true);
                    }
                };

                channel.BasicConsume(
                    queue: "paymentmock.order.created",
                    autoAck: false,
                    consumer: consumer);

                await Task.Delay(Timeout.Infinite, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "OrderCreatedConsumer failed, retrying in 5 seconds");
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
            finally
            {
                channel?.Dispose();
                connection?.Dispose();
            }
        }
    }
}