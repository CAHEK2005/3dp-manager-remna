#!/usr/bin/env bash
set -euo pipefail

trap 'echo -e "\033[1;31m[ERROR]\033[0m Ошибка в строке $LINENO"; exit 1' ERR

log()  { echo -e "\033[1;32m[INFO]\033[0m $1"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $1"; }
die()  { echo -e "\033[1;31m[ERROR]\033[0m $1"; exit 1; }

[[ $EUID -eq 0 ]] || die "Запускать только от root"

PROJECT_DIR="/opt/rwm-manager"

log "Обновление RWManager..."

[[ -d "$PROJECT_DIR" ]] || die "RWManager не установлен ($PROJECT_DIR не найден)"

cd "$PROJECT_DIR"

command -v docker >/dev/null 2>&1 || die "Docker не установлен"
docker compose version >/dev/null 2>&1 || die "docker compose v2 недоступен"

log "Сохранение конфигурации..."
cp docker-compose.yml docker-compose.yml.bak
cp client/nginx-client.conf client/nginx-client.conf.bak 2>/dev/null || true

log "Получение последних изменений из репозитория..."
git pull origin main

log "Восстановление конфигурации..."
cp docker-compose.yml.bak docker-compose.yml
cp client/nginx-client.conf.bak client/nginx-client.conf 2>/dev/null || true

log "Остановка контейнеров..."
docker compose down --remove-orphans

log "Пересборка и перезапуск контейнеров..."
docker compose up --build -d

log "RWManager успешно обновлён ✅"
