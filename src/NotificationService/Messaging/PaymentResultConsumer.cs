using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using NotificationService.Infrastructure;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using SharedContracts.Events;

namespace NotificationService.Messaging;

public sealed class PaymentResultConsumer : BackgroundService
{
    private readonly RabbitMqOptions _options;
    private readonly ILogger<PaymentResultConsumer> _logger;

    public PaymentResultConsumer(
        IOptions<RabbitMqOptions> options,
        ILogger<PaymentResultConsumer> logger)
    {
        _options = options.Value;
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
                    queue: "notificationservice.payment.result",
                    durable: true,
                    exclusive: false,
                    autoDelete: false,
                    arguments: null);
                channel.QueueBind(
                    queue: "notificationservice.payment.result",
                    exchange: _options.ExchangeName,
                    routingKey: "payment.result");

                var consumer = new AsyncEventingBasicConsumer(channel);
                consumer.Received += async (_, ea) =>
                {
                    try
                    {
                        var json = Encoding.UTF8.GetString(ea.Body.ToArray());
                        var paymentResult = JsonSerializer.Deserialize<PaymentResultEvent>(json);

                        if (paymentResult is not null)
                        {
                            _logger.LogInformation(
                                "Notification: Order {OrderId} payment status = {Status}, message = {Message}",
                                paymentResult.OrderId,
                                paymentResult.IsSuccess,
                                paymentResult.Message);
                        }

                        channel.BasicAck(ea.DeliveryTag, multiple: false);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Failed to process payment.result message");
                        channel.BasicNack(ea.DeliveryTag, multiple: false, requeue: true);
                    }

                    await Task.CompletedTask;
                };

                channel.BasicConsume(
                    queue: "notificationservice.payment.result",
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
                _logger.LogError(ex, "PaymentResultConsumer failed, retrying in 5 seconds");
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