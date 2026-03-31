.PHONY: help init up up-d down build logs logs-service clean status restart test

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

init: ## Create .env if missing and build containers
	@test -f .env || cp .env.example .env
	@echo "Environment file ready."
	docker compose build

up: ## Start all services
	docker compose up --build

up-d: ## Start all services (detached)
	docker compose up --build -d

down: ## Stop all services
	docker compose down

build: ## Rebuild all containers
	docker compose build --no-cache

logs: ## Tail logs from all services
	docker compose logs -f

logs-service: ## Tail logs from a specific service (usage: make logs-service s=service-a)
	docker compose logs -f $(s)

clean: ## Remove all containers, volumes, and images
	docker compose down -v --rmi all --remove-orphans

status: ## Show status of all services
	docker compose ps

restart: ## Restart all services
	docker compose restart

test: ## Run service tests in Docker
	docker compose run --rm service-a sh -lc "npm install && npm test"
	docker compose run --rm service-b sh -lc "npm install && npm test"
