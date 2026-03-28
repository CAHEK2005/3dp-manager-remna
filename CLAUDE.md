# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**RW Profile Manager** — утилита для автоматической ротации инбаундов в Remnawave (xray-based панель). Подключается к Remnawave по API-ключу, генерирует случайные инбаунды и обновляет config-профили по расписанию.

Стек: NestJS (backend) + React + Vite (frontend) + PostgreSQL, запускается через Docker Compose.

## Commands

### Backend (`server/`)
```bash
npm run start:dev     # Запуск в режиме разработки (watch)
npm run build         # Компиляция TypeScript → dist/
npm run lint          # ESLint с автофиксом
npm run test          # Jest unit тесты
npm run test:e2e      # E2E тесты (supertest)
```

### Frontend (`client/`)
```bash
npm run dev           # Vite dev server с HMR
npm run build         # Сборка для продакшна
npm run lint          # ESLint проверка
```

### Docker (полный стек)
```bash
docker-compose up --build
```

## Architecture

### Трёхуровневая архитектура
```
React (Nginx :80) → NestJS API (:3000) → PostgreSQL (:5432)
```

- Frontend проксирует `/api/` на `http://server:3000` через Nginx
- Глобальный префикс API: `/api`

### Backend (NestJS, feature-based модули)

Модули в `server/src/`:
- **auth** — JWT-аутентификация через Passport. Глобальный `JwtAuthGuard`, декоратор `@Public()` для публичных маршрутов. Единственный администратор сидируется из ENV при старте через `AuthService.seedAdmin()`.
- **remnawave** — HTTP-клиент к Remnawave API (Bearer токен). Все запросы читают `remnawave_url` и `remnawave_api_key` из БД при каждом вызове. Методы: `getConfigProfiles`, `updateConfigProfile`, `createConfigProfile`, `deleteConfigProfile`, `renameConfigProfile`, `getNodes`, `getAllHosts`, `createHost`, `updateHost`, `getX25519Keys`, `applyProfileToNode`, `checkConnection`.
- **inbounds** — `InboundBuilderService` строит JSON-объекты инбаундов для xray-core (vless-reality-tcp/xhttp/grpc, vless-ws, shadowsocks-tcp, trojan-reality-tcp). Также генерирует share-ссылки (vless://, vmess://, ss://, trojan://).
- **rotation** — `RotationService` хранит список `ManagedProfile[]` как JSON в `Setting.key = 'managed_profiles'`. Cron каждую минуту проверяет, какие профили пора ротировать. Поддерживает два режима: `interval` (минуты) и `schedule` (HH:MM + timezone). `performRotation`: генерирует инбаунды → обновляет профиль в Remnawave → `syncHosts` → `applyProfileToNode`.
- **settings** — CRUD key-value настроек в БД + прокси к Remnawave API (profiles, nodes, hosts). При сохранении `remnawave_url` автоматически определяет GeoIP страны через `ip-api.com`.
- **domains** — CRUD белого списка доменов для SNI (используются при `sni: 'random'` в inboundsConfig).

### ManagedProfile (ключевой тип)

```typescript
interface ManagedProfile {
  uuid: string;              // UUID профиля в Remnawave
  name: string;
  inboundsConfig: any[];     // [{type, port, sni}, ...] — конфигурация генерации
  nodeUuid: string;          // UUID ноды Remnawave
  nodeAddress: string;
  applyToNode: boolean;      // применять профиль к ноде после ротации
  hostMappings: { inboundType: string; hostUuid: string }[];  // UUID хостов для syncHosts
  hostTemplate: string;      // шаблон remark: '{countryCode} {nodeName} - {inboundType}'
  rotationEnabled: boolean;
  rotationMode: 'interval' | 'schedule';
  rotationInterval: number;  // минуты
  rotationScheduleTime: string; // 'HH:MM'
  rotationTimezone: string;
  lastRotationTimestamp: number;
  lastRotationStatus: 'success' | 'error' | null;
  lastRotationError: string;
}
```

Теги инбаундов в xray-конфиге имеют суффикс `-rw-manager` (например, `vless-tcp-reality-rw-manager`). `syncHosts` ищет инбаунд по `tag.startsWith(inboundType)`.

### Remnawave API endpoints (используемые)

- `GET /api/config-profiles` — список профилей; ответ: `{ response: { configProfiles: [] } }`
- `POST /api/config-profiles` — создание; `PATCH /api/config-profiles` body: `{ uuid, config }` или `{ uuid, name }` — обновление конфига/имени
- `DELETE /api/config-profiles/:uuid`
- `GET /api/nodes`; `POST /api/nodes/bulk-actions/profile-modification`
- `GET /api/hosts`; `POST /api/hosts`; `PATCH /api/hosts` body: `{ uuid, ...fields }`
- `GET /api/system/tools/x25519/generate` — ответ: `{ response: { keypairs: [{ publicKey, privateKey }] } }`

### База данных (TypeORM + PostgreSQL)

Сущности:
- **Setting** — key-value хранилище всей конфигурации. Ключевые записи: `remnawave_url`, `remnawave_api_key`, `managed_profiles` (JSON), `remnawave_geo_flag`, `remnawave_geo_country`.
- **Domain** — доменное имя для белого списка SNI (`name`, `isEnabled`).

`synchronize: true` — TypeORM автоматически синхронизирует схему (только две сущности: Setting, Domain).

### Frontend (React 19 + MUI)

Структура `client/src/`:
- **api.ts** — единственный Axios-инстанс с `baseURL: '/api'`
- **auth/** — `AuthContext` (JWT в localStorage), `RequireAuth`, `PublicRoute`, `AxiosInterceptor` (редирект на `/login` при 401)
- **ThemeContext.tsx** — переключение светлой/тёмной темы MUI
- **pages/**:
  - `ProfilesPage` — главная страница, управление ManagedProfiles (CRUD, ротация, создание хостов)
  - `SettingsPage` — настройки подключения к Remnawave + общие параметры
  - `DomainsPage` — белый список доменов SNI
  - `LoginPage`, `NotFoundPage`
- **components/** — `Layout` (Outlet + nav), `Header`, `Footer`

Управление состоянием: только React Context + локальный `useState`.

### Переменные окружения (`server/.env`)

```
DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME
ADMIN_LOGIN, ADMIN_PASSWORD
JWT_SECRET
```

Настройки подключения к Remnawave хранятся в БД (таблица `settings`), не в `.env`.
