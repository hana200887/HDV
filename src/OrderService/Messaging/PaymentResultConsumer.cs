using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using OrderService.Data;
using OrderService.Infrastructure;
using OrderService.Models;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using SharedContracts.Events;

namespace OrderService.Messaging;

public sealed class PaymentResultConsumer : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly RabbitMqOptions _options;
    private readonly ILogger<PaymentResultConsumer> _logger;

    public PaymentResultConsumer(
        IServiceScopeFactory scopeFactory,
        IOptions<RabbitMqOptions> options,
        ILogger<PaymentResultConsumer> logger)
    {
        _scopeFactory = scopeFactory;
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
                    queue: "orderservice.payment.result",
                    durable: true,
                    exclusive: false,
                    autoDelete: false,
                    arguments: null);
                channel.QueueBind(
                    queue: "orderservice.payment.result",
                    exchange: _options.ExchangeName,
                    routingKey: "payment.result");

                var consumer = new AsyncEventingBasicConsumer(channel);
                consumer.Received += async (_, ea) =>
                {
                    try
                    {
                        var json = Encoding.UTF8.GetString(ea.Body.ToArray());
                        var paymentResult = JsonSerializer.Deserialize<PaymentResultEvent>(json);

                        if (paymentResult is null)
                        {
                            channel.BasicAck(ea.DeliveryTag, multiple: false);
                            return;
                        }

                        using var scope = _scopeFactory.CreateScope();
                        var dbContext = scope.ServiceProvider.GetRequiredService<OrderDbContext>();

                        var order = await dbContext.Orders
                            .FirstOrDefaultAsync(x => x.Id == paymentResult.OrderId, stoppingToken);

                        if (order is not null)
                        {
                            order.Status = paymentResult.IsSuccess ? OrderStatus.Paid : OrderStatus.PaymentFailed;
                            await dbContext.SaveChangesAsync(stoppingToken);
                            _logger.LogInformation(
                                "Order {OrderId} updated to {Status}",
                                order.Id,
                                order.Status);
                        }

                        channel.BasicAck(ea.DeliveryTag, multiple: false);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Failed to process payment result message");
                        channel.BasicNack(ea.DeliveryTag, multiple: false, requeue: true);
                    }
                };

                channel.BasicConsume(
                    queue: "orderservice.payment.result",
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