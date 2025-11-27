#!/bin/zsh

# Останавливаемся при первой ошибке
set -e

# Всегда работаем из директории скрипта (корень репозитория)
SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
cd -- "$SCRIPT_DIR"

PORT="${PORT:-3000}"
SERVER_CMD="${SERVER_CMD:-node src/server.js}"
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

  echo "Запускаю сервер: ${SERVER_CMD}"
  nohup ${SERVER_CMD} > "${LOG_FILE}" 2>&1 &
  echo $! > "${PID_FILE}"
  echo "Сервер запущен (PID $(cat "${PID_FILE}")). Логи: ${LOG_FILE}"
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
