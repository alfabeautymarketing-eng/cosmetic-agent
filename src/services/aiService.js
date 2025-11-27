const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

class AiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    if (!this.apiKey) {
      console.warn('⚠️ GEMINI_API_KEY is not set. AI features will be disabled.');
    } else {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      // Используем gemini-2.5-pro - самая мощная доступная модель для обработки изображений и текста
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
      console.log('✅ Gemini AI initialized with model: gemini-2.5-pro');
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

  /**
   * Analyzes label only to extract information and suggest purpose/application
   * @param {Object} data - Product data with label text
   * @param {Buffer} imageBuffer - Label image buffer
   * @param {string} mimeType - Image mime type
   * @returns {Promise<Object>} - Extracted label data
   */
  async analyzeLabelOnly(data, imageBuffer, mimeType) {
    if (!this.genAI) {
      return {
        labelInfo: 'AI не настроен (отсутствует GEMINI_API_KEY)',
        suggestedPurpose: '',
        suggestedApplication: ''
      };
    }

    try {
      const prompt = `
        Analyze this cosmetic product label and extract information in JSON format:

        Product Name: ${data.productName}
        ${data.labelText ? `Label Text: ${data.labelText}` : 'Please read text from the image'}

        Output JSON structure:
        {
          "labelInfo": "Краткое описание информации с этикетки: производитель, объем, срок годности, сертификация, основные ингредиенты, предупреждения и т.д. (на русском, 2-3 предложения)",
          "suggestedPurpose": "Предполагаемое назначение продукта на основе информации с этикетки (краткое, 1-2 предложения на русском)",
          "suggestedApplication": "Предполагаемый способ применения продукта на основе инструкций с этикетки (краткое, 1-2 предложения на русском)"
        }

        Important:
        - Extract manufacturer, volume, expiry date if visible
        - Identify key active ingredients mentioned on front label
        - Note any certifications (organic, vegan, cruelty-free, etc.)
        - Read usage instructions if present
        - Base suggestions ONLY on information from the label
        - Be concise but informative
        - Write in Russian
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
      const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(jsonStr);

    } catch (error) {
      console.error('❌ AI Label Analysis failed:', error);
      return {
        labelInfo: 'Ошибка обработки этикетки',
        suggestedPurpose: '',
        suggestedApplication: ''
      };
    }
  }

  /**
   * Enhanced INCI analysis with percentage extraction
   * Extracts 4 composition variants: RU with %, RU without %, EN with %, EN without %
   * Plus active ingredients and booklet descriptions
   * @param {Object} data - Product data with INCI
   * @param {Buffer} imageBuffer - INCI document image buffer
   * @param {string} mimeType - Image mime type
   * @returns {Promise<Object>} - Comprehensive INCI analysis
   */
  async analyzeInciEnhanced(data, imageBuffer, mimeType) {
    if (!this.genAI) {
      return this.getMockData();
    }

    try {
      const prompt = `
        Analyze this cosmetic product INCI composition and extract comprehensive information in JSON format:

        Product Name: ${data.productName}
        Purpose: ${data.purpose}
        INCI: ${data.inci || 'Please try to read from image'}

        Output JSON structure:
        {
          "fullCompositionRuWithPercent": "Полный состав на русском языке С ПРОЦЕНТАМИ (если указаны в INCI). Если процентов нет, оставить пустым.",
          "fullCompositionRuNoPercent": "Полный состав на русском языке БЕЗ ПРОЦЕНТОВ, от большего к меньшему",
          "fullCompositionEnWithPercent": "Full composition in English WITH PERCENTAGES (if provided in INCI). Leave empty if no percentages.",
          "fullCompositionEnNoPercent": "Full composition in English WITHOUT PERCENTAGES, from highest to lowest",
          "activeIngredients": ["Список АКТИВНЫХ ингредиентов на русском БЕЗ % (только те, что имеют косметический эффект)"],
          "activeIngredientsEn": ["List of ACTIVE ingredients in English WITHOUT % (only those with cosmetic effect)"],
          "bookletComposition": "Краткое маркетинговое описание состава для буклета (2-3 предложения, русский, подчеркивает пользу)",
          "bookletCompositionEn": "Short marketing composition description for booklet (2-3 sentences, English, highlights benefits)"
        }

        CRITICAL RULES:
        1. If INCI contains percentages (e.g., "Water 70%, Glycerin 20%"), extract them for "WithPercent" fields
        2. If NO percentages in INCI, leave "WithPercent" fields EMPTY (do not invent percentages)
        3. "NoPercent" fields must list ingredients in descending order without any percentages
        4. ACTIVE ingredients are those with cosmetic/therapeutic effects (not preservatives, water, emulsifiers)
        5. Translate ingredient names accurately between Russian and English
        6. For booklet descriptions, focus on key benefits and marketing appeal
        7. Maintain professional cosmetic industry terminology
        8. Do NOT include percentages in activeIngredients arrays

        Example active ingredients:
        - Hyaluronic Acid, Retinol, Vitamin C, Niacinamide, Peptides, Plant Extracts
        - NOT: Water, Glycerin (unless >10%), Preservatives, Emulsifiers

        If you cannot read INCI from text or image, return error message in each field.
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
      const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(jsonStr);

      // Map to the format expected by sheetsService
      // We use fullComposition (without %) as the default
      return {
        fullComposition: parsed.fullCompositionRuNoPercent,
        fullCompositionEn: parsed.fullCompositionEnNoPercent,
        fullCompositionWithPercent: parsed.fullCompositionRuWithPercent || parsed.fullCompositionRuNoPercent,
        fullCompositionEnWithPercent: parsed.fullCompositionEnWithPercent || parsed.fullCompositionEnNoPercent,
        activeIngredients: parsed.activeIngredients,
        activeIngredientsEn: parsed.activeIngredientsEn,
        bookletComposition: parsed.bookletComposition,
        bookletCompositionEn: parsed.bookletCompositionEn
      };

    } catch (error) {
      console.error('❌ AI INCI Enhanced Analysis failed:', error);
      return this.getMockData();
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
