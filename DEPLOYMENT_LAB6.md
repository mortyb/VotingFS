# Lab 6: Containerization and Deployment

## Архитектура сервисов

- `reverse-proxy` — публичная точка входа на `http://localhost`, маршрутизирует трафик.
- `frontend` — статическая React/Vite сборка внутри Nginx.
- `backend` — FastAPI приложение с бизнес-логикой и API.
- `postgres` — основная база данных приложения.
- `minio` — S3-совместимое объектное хранилище для пользовательских файлов.

## Сетевая схема

- Внешний пользователь обращается к `reverse-proxy:80`.
- `reverse-proxy` отправляет:
  - `/` -> `frontend:80`
  - `/api/` -> `backend:8000`
- `backend` обращается к:
  - `postgres:5432`
  - `minio:9000`

## Какие файлы добавлены

- `/Users/bahramovbahram/Desktop/VotingFS/backend/Dockerfile`
- `/Users/bahramovbahram/Desktop/VotingFS/frontend/Dockerfile`
- `/Users/bahramovbahram/Desktop/VotingFS/docker-compose.yml`
- `/Users/bahramovbahram/Desktop/VotingFS/deploy/nginx/reverse-proxy.conf`
- `/Users/bahramovbahram/Desktop/VotingFS/frontend/nginx.conf`
- `/Users/bahramovbahram/Desktop/VotingFS/.env.example`
- `/Users/bahramovbahram/Desktop/VotingFS/backend/app/.env.example`
- `/Users/bahramovbahram/Desktop/VotingFS/.github/workflows/ci-cd.yml`

## Локальный запуск

1. Скопировать шаблон окружения:

```bash
cp .env.example .env
```

2. При необходимости заменить секреты и пароли в `.env`.

3. Запустить все сервисы одной командой:

```bash
docker compose up --build
```

## Что поднимется

- приложение: `http://localhost`
- backend healthcheck: `http://localhost/api/health`
- MinIO console: `http://localhost:9001`

## Healthchecks и порядок запуска

- `postgres` ждет готовности через `pg_isready`
- `minio` проверяется через встроенный HTTP health endpoint
- `backend` стартует после готовности `postgres` и `minio`
- `frontend` стартует после готовности `backend`
- `reverse-proxy` стартует после `frontend` и `backend`

## Безопасная конфигурация

- Секреты вынесены в переменные окружения.
- Реальные `.env` добавлены в `.gitignore`.
- В репозитории оставлены только шаблоны `.env.example`.

## CI/CD

GitHub Actions делает три обязательных шага:

1. backend tests (`pytest`)
2. frontend quality (`lint`, `vitest`, `build`)
3. сборка контейнеров через `docker compose build`

После успешных проверок workflow может автоматически развернуть проект на сервере по SSH, если настроены секреты:

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`
- `DEPLOY_PATH`

## Что проверять на защите

1. `docker compose up --build` поднимает все сервисы одной командой.
2. `http://localhost` открывает frontend.
3. `http://localhost/api/health` возвращает статус backend.
4. MinIO console доступна на `http://localhost:9001`.
5. Секреты не лежат в репозитории в открытом виде, используются переменные окружения.
6. CI/CD workflow запускает тесты и собирает контейнеры автоматически.
