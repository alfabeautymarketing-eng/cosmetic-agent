// Скрипт для получения списка доступных моделей через REST API
require('dotenv').config();

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY not found in .env');
    return;
  }

  console.log('🔍 Fetching available Gemini models from API...\n');

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.models || data.models.length === 0) {
      console.log('❌ No models found');
      return;
    }

    console.log(`✅ Found ${data.models.length} models:\n`);

    data.models.forEach((model, index) => {
      console.log(`${index + 1}. ${model.name}`);
      console.log(`   Display Name: ${model.displayName || 'N/A'}`);
      console.log(`   Description: ${model.description || 'N/A'}`);

      if (model.supportedGenerationMethods && model.supportedGenerationMethods.length > 0) {
        console.log(`   Supported Methods: ${model.supportedGenerationMethods.join(', ')}`);
      }

      console.log('');
    });

    // Найдем модели, которые поддерживают generateContent
    const contentModels = data.models.filter(m =>
      m.supportedGenerationMethods &&
      m.supportedGenerationMethods.includes('generateContent')
    );

    if (contentModels.length > 0) {
      console.log('\n📋 Models that support generateContent:');
      contentModels.forEach(model => {
        // Извлекаем короткое имя модели (models/gemini-pro -> gemini-pro)
        const shortName = model.name.replace('models/', '');
        console.log(`  - ${shortName}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

listModels();
