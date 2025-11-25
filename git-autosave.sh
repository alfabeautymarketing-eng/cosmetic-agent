#!/bin/zsh

# Останавливаемся при первой ошибке
set -e

# Всегда работаем из директории скрипта (корень репозитория)
SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
cd -- "$SCRIPT_DIR"

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
