# Lab 5: Комплексное тестирование MVP

## 1. Тестовая модель приложения

### Критические пользовательские сценарии
- Регистрация -> вход -> получение профиля `/auth/me` -> обновление access по refresh -> выход.
- CRUD опросов с ограничениями ролей.
- Голосование и защита от повторного голоса.
- Ролевой доступ к административным операциям.
- Работа внешнего API цитат в штатном и аварийном режиме.

### Ключевые бизнес-правила
- `access token` обязателен на защищенных маршрутах.
- `refresh token` ротируется и может быть отозван.
- Пользователь без `user:manage_roles` не может управлять ролями.
- При создании опроса минимум 2 непустых варианта.
- Дублирующее голосование запрещено.

### Риски
- Аутентификация и срок жизни токенов.
- RBAC/проверки прав доступа.
- Файловые операции и внешние интеграции.
- Падение внешнего API (нужен graceful degradation).

## 2. Что реализовано

### Backend
- Unit:
  - `backend/tests/unit/test_auth_service.py`
  - `backend/tests/unit/test_external_quote_service.py`
- Integration:
  - `backend/tests/integration/test_auth_endpoints.py`
  - `backend/tests/integration/test_rbac_and_polls.py`
- E2E (API business flows):
  - `backend/tests/e2e/test_business_flows.py`
- Инфраструктура:
  - `backend/tests/conftest.py` (изолированная SQLite БД, фикстуры, fake MinIO, очистка)
  - `backend/pytest.ini` (маркеры unit/integration/e2e, coverage)
  - `backend/requirements-dev.txt`

### Frontend
- Unit/integration:
  - `frontend/src/components/__tests__/Seo.test.tsx`
  - `frontend/src/pages/__tests__/Login.test.tsx`
  - `frontend/src/Layout.test.tsx`
  - `frontend/src/AuthContext.test.tsx`
- E2E:
  - `frontend/e2e/app-flows.spec.ts`
- Инфраструктура:
  - `frontend/vite.config.ts` (vitest + coverage)
  - `frontend/src/test/setup.ts`
  - `frontend/playwright.config.ts`
  - `frontend/package.json` (test scripts)

## 3. Разделение тестов по скорости
- Быстрые: `unit`.
- Средние: `integration`.
- Длинные: `e2e`.

Backend:
- `pytest -m unit`
- `pytest -m integration`
- `pytest -m e2e`

Frontend:
- `npm run test`
- `npm run e2e`

## 4. Правила именования и структуры
- Файлы: `test_<feature>.py`, `<Component>.test.tsx`, `<flow>.spec.ts`.
- Тесты: `test_<expected_behavior>`.
- Одна папка на уровень: `unit`, `integration`, `e2e`.

## 5. Покрытие
- Backend: `pytest-cov` в `pytest.ini`.
- Frontend: `vitest` coverage thresholds в `frontend/vite.config.ts`.

## 6. Проверка запуска
- Backend: `cd backend && venv/bin/python -m pytest`
- Frontend unit: `cd frontend && npm run test`
- Frontend e2e: `cd frontend && npm run e2e`
