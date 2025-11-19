/**
 * Тестовый скрипт для проверки webhook
 *
 * Запуск: node test-webhook.js
 */

const axios = require('axios');

const testData = {
  chatId: '123456789',
  productName: 'Крем увлажняющий тестовый',
  purpose: 'Увлажнение и питание кожи',
  application: 'Наносить на чистую кожу лица утром и вечером',
  inci: 'Aqua, Glycerin, Hyaluronic Acid, Vitamin E, Phenoxyethanol',
  inciDocUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', // Тестовый PDF
  photoUrls: [
    'https://via.placeholder.com/300.jpg', // Тестовое изображение
  ]
};

async function testWebhook() {
  try {
    console.log('🧪 Отправка тестового webhook...\n');
    console.log('Данные:', JSON.stringify(testData, null, 2));
    console.log('\n---\n');

    const response = await axios.post('http://localhost:3000/webhook', testData, {
      headers: {
        'Content-Type': 'application/json',
        // Если используешь WEBHOOK_SECRET, раскомментируй:
        // 'x-webhook-secret': 'my-secret-key-123'
      }
    });

    console.log('✅ Успешный ответ:');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('❌ Ошибка:');
    if (error.response) {
      console.error('Статус:', error.response.status);
      console.error('Данные:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

// Проверка, что сервер запущен
async function checkHealth() {
  try {
    const response = await axios.get('http://localhost:3000/health');
    console.log('✅ Сервер работает:', response.data);
    console.log('---\n');
    return true;
  } catch (error) {
    console.error('❌ Сервер не доступен. Убедись, что запустил сервер командой: npm run dev');
    return false;
  }
}

// Главная функция
async function main() {
  console.log('=== Тест Cosmetic Agent Webhook ===\n');

  const isServerRunning = await checkHealth();
  if (!isServerRunning) {
    process.exit(1);
  }

  await testWebhook();
}

main();
