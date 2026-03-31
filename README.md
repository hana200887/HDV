# Mini Food Ordering Microservices (.NET)

Đây là dự án microservices dùng cho BTL với các thành phần:

- API Gateway (`Ocelot`)
- `AuthService`
- `MenuService`
- `OrderService`
- `PaymentMockService`
- `NotificationService`
- `Consul`, `RabbitMQ`, `PostgreSQL`, `Redis`, `Zipkin`, `Elasticsearch`, `Kibana`

## Tài liệu học đầy đủ

Xem tài liệu chi tiết tại:

- [docs/HOC_DU_AN_MICROSERVICES.md](docs/HOC_DU_AN_MICROSERVICES.md)

Tài liệu trên bao gồm:

- Kiến trúc tổng thể và sơ đồ luồng
- Giải thích từng service
- API reference và event contracts
- Hướng dẫn chạy và test end-to-end
- Observability (Zipkin/Kibana)
- Troubleshooting
- Checklist demo bảo vệ và lộ trình học

## Chạy nhanh

Yêu cầu: Docker Desktop đang chạy.

```bash
docker compose up --build
```

Endpoint chính:

- Gateway: `http://localhost:5000`
- Consul: `http://localhost:8500`
- RabbitMQ: `http://localhost:15672`
- Zipkin: `http://localhost:9411`
- Kibana: `http://localhost:5601`