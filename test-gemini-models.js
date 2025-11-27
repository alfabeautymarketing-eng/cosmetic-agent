// Скрипт для проверки доступных моделей Gemini
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testModels() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY not found in .env');
    return;
  }

  console.log('🔍 Checking available Gemini models...\n');

  const genAI = new GoogleGenerativeAI(apiKey);

  const modelsToTest = [
    'gemini-pro',
    'gemini-pro-vision',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-1.5-pro-latest',
    'gemini-1.5-flash-latest'
  ];

  for (const modelName of modelsToTest) {
    try {
      console.log(`Testing: ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });

      const result = await model.generateContent('Say "Hello" in one word');
      const response = await result.response;
      const text = response.text();

      console.log(`  ✅ ${modelName} - WORKS! Response: ${text.trim()}\n`);
    } catch (error) {
      console.log(`  ❌ ${modelName} - ERROR: ${error.message}\n`);
    }
  }
}

testModels();
