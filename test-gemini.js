/**
 * Скрипт для тестирования Gemini API
 *
 * Использование:
 * 1. Получите API ключ на https://aistudio.google.com/app/apikey
 * 2. Добавьте ключ в .env: GEMINI_API_KEY=ваш_ключ
 * 3. Запустите: node test-gemini.js
 */

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGemini() {
    console.log('\n🤖 Тестирование Gemini API...\n');

    // Проверяем наличие API ключа
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error('❌ ОШИБКА: GEMINI_API_KEY не найден в файле .env');
        console.log('\n📝 Что нужно сделать:');
        console.log('1. Откройте https://aistudio.google.com/app/apikey');
        console.log('2. Создайте API ключ');
        console.log('3. Добавьте в файл .env строку:');
        console.log('   GEMINI_API_KEY=your_api_key_here');
        console.log('4. Запустите этот скрипт снова: node test-gemini.js\n');
        process.exit(1);
    }

    console.log('✅ API ключ найден:', apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 4));

    try {
        // Инициализация Gemini
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

        console.log('🔄 Отправка тестового запроса к Gemini...\n');

        // Тестовый запрос
        const prompt = `
            Проанализируй следующий косметический продукт:

            Название: Увлажняющий крем для лица
            INCI: Aqua (70%), Glycerin (15%), Hyaluronic Acid (5%), Vitamin E (3%), Shea Butter (7%)

            Верни JSON с полями:
            {
                "activeIngredients": ["список активных ингредиентов на русском"],
                "activeIngredientsEn": ["список на английском"],
                "bookletComposition": "краткое описание состава для буклета на русском",
                "bookletCompositionEn": "краткое описание на английском"
            }
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log('✅ Ответ получен от Gemini!\n');
        console.log('📄 Результат:');
        console.log('─'.repeat(80));
        console.log(text);
        console.log('─'.repeat(80));

        // Попытка парсить JSON
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                console.log('\n✅ JSON успешно распознан:');
                console.log(JSON.stringify(parsed, null, 2));
            }
        } catch (e) {
            console.log('\n⚠️ Не удалось распарсить JSON, но ответ получен');
        }

        console.log('\n🎉 ТЕСТ ПРОЙДЕН УСПЕШНО!');
        console.log('\n✨ Gemini API работает корректно.');
        console.log('Теперь вы можете использовать AI в приложении:\n');
        console.log('1. Запустите сервер: node src/server.js');
        console.log('2. Откройте http://localhost:3000');
        console.log('3. Создайте карточку и загрузите этикетку/INCI');
        console.log('4. AI автоматически обработает данные\n');

    } catch (error) {
        console.error('\n❌ ОШИБКА при работе с Gemini API:\n');

        if (error.message.includes('API_KEY_INVALID')) {
            console.log('🔑 Проблема с API ключом:');
            console.log('- Проверьте, что ключ скопирован правильно');
            console.log('- Убедитесь, что ключ активен на https://aistudio.google.com/app/apikey');
            console.log('- Попробуйте создать новый ключ');
        } else if (error.message.includes('quota')) {
            console.log('📊 Превышен лимит запросов:');
            console.log('- Бесплатный план: 15 запросов/минуту');
            console.log('- Подождите 1 минуту и попробуйте снова');
        } else {
            console.log('Детали ошибки:', error.message);
        }

        console.log('\n📖 Полная документация: https://ai.google.dev/docs\n');
        process.exit(1);
    }
}

// Запуск теста
testGemini().catch(error => {
    console.error('\n❌ Неожиданная ошибка:', error);
    process.exit(1);
});
