# Инструкция по установке зависимостей

У тебя проблема с правами доступа к npm кешу. Вот как исправить:

## Исправление проблемы

Открой **Терминал** и выполни эту команду:

```bash
sudo chown -R $(whoami) ~/.npm
```

Введи пароль своего Mac когда попросит.

## Установка зависимостей

После исправления прав:

```bash
cd /Users/aleksandr/Desktop/cosmetic-agent
npm install
```

Это установит:
- `multer` - для загрузки файлов
- `pdf-parse` - для извлечения текста из PDF

## Если не получается

Альтернативный способ:

```bash
npm install --prefer-offline multer pdf-parse
```

Или установи через yarn:

```bash
brew install yarn
yarn add multer pdf-parse
```
