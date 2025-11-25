#!/bin/zsh

set -e

REPO_DIR="/Users/aleksandr/Desktop/cosmetic-agent"
PORT="${PORT:-3000}"
SERVER_CMD="node src/server.js"
LOG_FILE="${REPO_DIR}/server.log"
PID_FILE="${REPO_DIR}/.server.pid"

cd -- "$REPO_DIR"

# Останавливаем запущенный сервер на заданном порту (если есть)
SERVER_PIDS=$(lsof -ti tcp:${PORT} || true)
if [ -n "$SERVER_PIDS" ]; then
  echo "Останавливаю сервер на порту ${PORT} (PID: $SERVER_PIDS)..."
  kill -INT $SERVER_PIDS || true
  sleep 1
fi

echo "Запускаю сервер командой: ${SERVER_CMD}"
nohup ${SERVER_CMD} > "${LOG_FILE}" 2>&1 &
echo $! > "${PID_FILE}"
echo "Сервер запущен (PID $(cat "${PID_FILE}")). Логи: ${LOG_FILE}"

# Автокоммит и пуш
./git-autosave.sh
