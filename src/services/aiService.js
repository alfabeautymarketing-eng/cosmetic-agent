const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

class AiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    if (!this.apiKey) {
      console.warn('⚠️ GEMINI_API_KEY is not set. AI features will be disabled.');
    } else {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      // Используем gemini-1.5-pro как наиболее мощную доступную модель (по запросу "Gemini 3")
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    }
  }

  /**
   * Analyzes product data to extract ingredients and generate descriptions.
   * @param {Object} data - Product data (inci, name, purpose, etc.)
   * @param {Buffer} [imageBuffer] - Optional image buffer of the product/label
   * @param {string} [mimeType] - Mime type of the image
   * @returns {Promise<Object>} - Extracted data
   */
  async analyzeProduct(data, imageBuffer = null, mimeType = 'image/jpeg') {
    if (!this.genAI) {
      return this.getMockData();
    }

    try {
      const prompt = `
        Analyze this cosmetic product and extract/generate the following information in JSON format:
        
        Product Name: ${data.productName}
        Purpose: ${data.purpose}
        INCI (Ingredients): ${data.inci || 'Not provided, try to read from image'}

        Output JSON structure:
        {
          "activeIngredients": ["List of active ingredients in Russian"],
          "activeIngredientsEn": ["List of active ingredients in English"],
          "bookletComposition": "Short composition description for marketing booklet (Russian)",
          "bookletCompositionEn": "Short composition description for marketing booklet (English)",
          "fullComposition": "Full composition list translated to Russian",
          "fullCompositionEn": "Full composition list in English (standard INCI)"
        }

        If INCI is provided in text, use it. If not, try to read it from the image.
        Focus on accuracy and marketing appeal for the booklet descriptions.
      `;

      let result;
      if (imageBuffer) {
        const imagePart = {
          inlineData: {
            data: imageBuffer.toString('base64'),
            mimeType: mimeType,
          },
        };
        result = await this.model.generateContent([prompt, imagePart]);
      } else {
        result = await this.model.generateContent(prompt);
      }

      const response = await result.response;
      const text = response.text();
      
      // Clean up markdown code blocks if present
      const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(jsonStr);

    } catch (error) {
      console.error('❌ AI Analysis failed:', error);
      return this.getMockData(); // Fallback to avoid breaking the flow
    }
  }

  getMockData() {
    return {
      activeIngredients: ['Данные не извлечены (нет API ключа или ошибка)'],
      activeIngredientsEn: ['Data not extracted'],
      bookletComposition: 'Ошибка обработки AI',
      bookletCompositionEn: 'AI Processing Error',
      fullComposition: 'Ошибка обработки AI',
      fullCompositionEn: 'AI Processing Error'
    };
  }
}

module.exports = new AiService();
