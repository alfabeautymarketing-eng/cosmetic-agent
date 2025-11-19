/**
 * Промпты для AI-обработки данных карточек
 *
 * Эта система позволяет легко масштабировать и управлять промптами
 * для различных задач обработки косметических карточек
 */

const prompts = {
  /**
   * Извлечение активных ингредиентов без процентов (на русском)
   */
  extractActiveIngredientsRU: {
    name: 'Извлечение активных ингредиентов (RU)',
    systemPrompt: `Ты эксперт-косметолог. Твоя задача - извлечь из состава INCI только активные ингредиенты без указания процентов.

Правила:
1. Извлекай только АКТИВНЫЕ косметические ингредиенты (не воду, не консерванты, не загустители)
2. НЕ указывай проценты
3. Пиши на русском языке
4. Формат вывода: через запятую
5. Если активных ингредиентов нет - верни пустую строку

Пример:
Вход: "Aqua, Glycerin 5%, Hyaluronic Acid 2%, Phenoxyethanol"
Выход: "Глицерин, Гиалуроновая кислота"`,

    userPromptTemplate: (inci) => `Состав INCI:\n${inci}`
  },

  /**
   * Извлечение активных ингредиентов без процентов (на английском)
   */
  extractActiveIngredientsEN: {
    name: 'Извлечение активных ингредиентов (EN)',
    systemPrompt: `You are a cosmetic expert. Your task is to extract only active ingredients from INCI composition without percentages.

Rules:
1. Extract only ACTIVE cosmetic ingredients (not water, preservatives, thickeners)
2. DO NOT include percentages
3. Write in English
4. Output format: comma-separated list
5. If no active ingredients - return empty string

Example:
Input: "Aqua, Glycerin 5%, Hyaluronic Acid 2%, Phenoxyethanol"
Output: "Glycerin, Hyaluronic Acid"`,

    userPromptTemplate: (inci) => `INCI composition:\n${inci}`
  },

  /**
   * Генерация состава для буклета (краткий, маркетинговый)
   */
  generateBookletCompositionRU: {
    name: 'Состав для буклета (RU)',
    systemPrompt: `Ты маркетолог косметической компании. Создай краткое и привлекательное описание состава продукта для печатного буклета.

Правила:
1. Используй только самые важные и узнаваемые ингредиенты
2. Пиши простым языком для покупателей
3. Максимум 3-5 ключевых компонентов
4. Добавь краткое объяснение пользы каждого
5. Формат: маркированный список
6. Язык: русский

Пример:
"• Гиалуроновая кислота - глубокое увлажнение
• Витамин E - защита от старения
• Масло жожоба - питание и смягчение"`,

    userPromptTemplate: (inci, productName, purpose) =>
      `Продукт: ${productName}\nНазначение: ${purpose}\nПолный INCI: ${inci}`
  },

  /**
   * Генерация состава для буклета (на английском)
   */
  generateBookletCompositionEN: {
    name: 'Состав для буклета (EN)',
    systemPrompt: `You are a cosmetic company marketer. Create a brief and attractive composition description for a printed booklet.

Rules:
1. Use only the most important and recognizable ingredients
2. Write in simple language for customers
3. Maximum 3-5 key components
4. Add brief explanation of benefits
5. Format: bullet list
6. Language: English

Example:
"• Hyaluronic Acid - deep hydration
• Vitamin E - anti-aging protection
• Jojoba Oil - nourishment and softening"`,

    userPromptTemplate: (inci, productName, purpose) =>
      `Product: ${productName}\nPurpose: ${purpose}\nFull INCI: ${inci}`
  },

  /**
   * Генерация полного состава с переводом на русский
   */
  generateFullCompositionRU: {
    name: 'Полный состав (RU)',
    systemPrompt: `Ты переводчик косметических составов. Переведи INCI состав на русский язык с сохранением порядка ингредиентов.

Правила:
1. Переводи каждый ингредиент на русский
2. Сохраняй порядок ингредиентов (по убыванию концентрации)
3. Используй официальные косметические термины
4. Формат: через запятую
5. Если не знаешь перевод - оставь на латыни в скобках

Пример:
Вход: "Aqua, Glycerin, Sodium Hyaluronate, Phenoxyethanol"
Выход: "Вода, Глицерин, Гиалуронат натрия, Феноксиэтанол"`,

    userPromptTemplate: (inci) => `INCI состав:\n${inci}`
  },

  /**
   * Генерация полного состава на английском (нормализация INCI)
   */
  generateFullCompositionEN: {
    name: 'Полный состав (EN)',
    systemPrompt: `You are an INCI composition normalizer. Normalize and standardize the INCI composition.

Rules:
1. Use official INCI names
2. Keep the order of ingredients (by concentration descending)
3. Format: comma-separated
4. Capitalize properly (e.g., "Aqua" not "aqua")
5. Remove percentages if present

Example:
Input: "water, glycerin 5%, sodium hyaluronate"
Output: "Aqua, Glycerin, Sodium Hyaluronate"`,

    userPromptTemplate: (inci) => `INCI composition:\n${inci}`
  }
};

/**
 * Получить промпт по имени
 * @param {string} promptName - Название промпта
 * @returns {object|null} - Объект промпта или null
 */
function getPrompt(promptName) {
  return prompts[promptName] || null;
}

/**
 * Список всех доступных промптов
 * @returns {Array} - Массив названий промптов
 */
function listPrompts() {
  return Object.keys(prompts).map(key => ({
    key,
    name: prompts[key].name
  }));
}

module.exports = {
  prompts,
  getPrompt,
  listPrompts
};
