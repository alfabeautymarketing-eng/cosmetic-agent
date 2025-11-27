#!/bin/zsh

# Останавливаемся при первой ошибке
set -e

# Всегда работаем из директории скрипта (корень репозитория)
SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
cd -- "$SCRIPT_DIR"

PORT="${PORT:-3000}"
NODE_BIN="$(command -v node || true)"
SERVER_BIN="${NODE_BIN:-/usr/local/bin/node}"
SERVER_CMD="${SERVER_CMD:-${SERVER_BIN} ${SCRIPT_DIR}/src/server.js}"
SERVER_ENV="BIND_HOST=${BIND_HOST:-127.0.0.1} PORT=${PORT}"
LOG_FILE="${SCRIPT_DIR}/server.log"
PID_FILE="${SCRIPT_DIR}/.server.pid"

restart_server() {
  local pids
  pids=$(lsof -ti tcp:${PORT} || true)

  if [ -n "$pids" ]; then
    echo "Останавливаю сервер на порту ${PORT} (PID: $pids)..."
    kill -INT $pids || true
    sleep 1
  fi

  echo "Запускаю сервер: ${SERVER_ENV} ${SERVER_CMD}"
  nohup env ${SERVER_ENV} ${SERVER_CMD} > "${LOG_FILE}" 2>&1 &
  echo $! > "${PID_FILE}"
  sleep 1

  if lsof -ti tcp:${PORT} >/dev/null; then
    echo "Сервер запущен (PID $(cat "${PID_FILE}")). Логи: ${LOG_FILE}"
  else
    echo "⚠️ Сервер не открыл порт ${PORT}. Проверьте ${LOG_FILE}"
  fi
}

# Проверяем, есть ли изменения
changes=$(git status --porcelain)

if [ -z "$changes" ]; then
  echo "Нет изменений — коммит не нужен."
  exit 0
fi

# Добавляем все изменения
git add -A

# Делаем коммит с меткой времени
timestamp=$(date "+%Y-%m-%d %H:%M:%S")
git commit -m "autosave: $timestamp"

# Пушим в main
git push origin main

echo "✅ Готово: изменения закоммичены и отправлены на GitHub."

# Перезапускаем сервер, чтобы применить изменения
restart_server
