// ====================
// Состояние карточки
// ====================
let currentCard = {
    cardId: null,
    cardFolderId: null,
    userFolderId: null,
    photosFolderId: null,
    productName: null,
    purpose: null,
    application: null
};

// Текущий метод загрузки для каждого блока
let uploadMethods = {
    label: 'file',
    inci: 'file',
    photo: 'file'
};

// ====================
// Авторизация и проверка
// ====================
function getAuthToken() {
    return localStorage.getItem('authToken');
}

function checkAuth() {
    const token = getAuthToken();
    if (!token) {
        alert('Для создания карточки необходимо авторизоваться');
        openLoginModal();
        return false;
    }
    return true;
}

// ====================
// Управление прогрессом
// ====================
function showBlock(blockNumber) {
    // Скрываем все блоки
    for (let i = 1; i <= 5; i++) {
        document.getElementById(`block${i}`).classList.add('hidden');
        document.getElementById(`block${i}`).classList.remove('active');
    }

    // Показываем нужный блок
    document.getElementById(`block${blockNumber}`).classList.remove('hidden');
    document.getElementById(`block${blockNumber}`).classList.add('active');

    // Обновляем прогресс-индикатор
    updateProgress(blockNumber);

    // Скроллим к блоку
    document.getElementById(`block${blockNumber}`).scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updateProgress(activeBlock) {
    const steps = document.querySelectorAll('.progress-step');

    steps.forEach((step, index) => {
        const blockNum = index + 1;
        step.classList.remove('active', 'completed', 'disabled');

        if (blockNum < activeBlock) {
            step.classList.add('completed');
        } else if (blockNum === activeBlock) {
            step.classList.add('active');
        } else {
            step.classList.add('disabled');
        }
    });
}

// ====================
// BLOCK 1: Create Card (Name Only)
// ====================
async function createCard() {
    if (!checkAuth()) return;

    const productName = document.getElementById('productName').value.trim();

    // Валидация
    if (!productName) {
        alert('Введите наименование продукта');
        return;
    }

    const btn = document.getElementById('createCardBtn');
    const loading = document.getElementById('loading1');
    const alert1 = document.getElementById('alert1');

    btn.disabled = true;
    loading.classList.add('active');
    alert1.classList.add('hidden');

    try {
        // Временные значения для purpose и application (заполним в блоке 2)
        const response = await fetch('/api/cards/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify({
                productName,
                purpose: 'Заполнить в блоке Информация',
                application: 'Заполнить в блоке Информация'
            })
        });

        const data = await response.json();

        loading.classList.remove('active');

        if (response.status === 401) {
            localStorage.removeItem('authToken');
            alert('Ваша сессия истекла. Пожалуйста, войдите снова');
            openLoginModal();
            return;
        }

        if (!data.success) {
            alert(`Ошибка: ${data.error}`);
            btn.disabled = false;
            return;
        }

        // Сохраняем данные карточки
        currentCard.cardId = data.cardId;
        currentCard.cardFolderId = data.cardFolderId;
        currentCard.userFolderId = data.userFolderId;
        currentCard.photosFolderId = data.photosFolderId;
        currentCard.productName = productName;

        // Показываем успех с кнопкой редактирования
        alert1.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>✅ Карточка создана! ID: ${data.cardId}</span>
                <button onclick="enableNameEdit()" class="btn-secondary" style="padding: 8px 16px; font-size: 12px;">
                    ✏️ Изменить название
                </button>
            </div>
        `;
        alert1.classList.remove('hidden');

        // Переходим к следующему блоку через 1 секунду
        setTimeout(() => {
            showBlock(2);
        }, 1000);

    } catch (error) {
        loading.classList.remove('active');
        btn.disabled = false;
        alert(`Ошибка соединения: ${error.message}`);
    }
}

// ====================
// Phase 5: Edit Product Name
// ====================
function enableNameEdit() {
    const productNameInput = document.getElementById('productName');
    const currentName = productNameInput.value;

    // Делаем поле редактируемым и фокусируемся
    productNameInput.disabled = false;
    productNameInput.focus();
    productNameInput.select();

    // Меняем кнопку "Создать карточку" на "Сохранить изменения"
    const createBtn = document.getElementById('createCardBtn');
    createBtn.textContent = '💾 Сохранить изменения';
    createBtn.onclick = updateProductName;

    // Обновляем alert
    const alert1 = document.getElementById('alert1');
    alert1.innerHTML = `
        <div style="color: #856404; background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 10px;">
            ⚠️ Режим редактирования. Измените название и нажмите "Сохранить изменения"
        </div>
    `;
}

async function updateProductName() {
    const newName = document.getElementById('productName').value.trim();

    if (!newName) {
        alert('Введите название продукта');
        return;
    }

    if (newName === currentCard.productName) {
        alert('Название не изменилось');
        enableNameEdit();
        return;
    }

    const btn = document.getElementById('createCardBtn');
    const loading = document.getElementById('loading1');
    const alert1 = document.getElementById('alert1');

    btn.disabled = true;
    loading.classList.add('active');

    try {
        const response = await fetch(`/api/cards/${currentCard.cardId}/name`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify({
                newName,
                cardFolderId: currentCard.cardFolderId
            })
        });

        const data = await response.json();

        loading.classList.remove('active');

        if (!data.success) {
            alert(`Ошибка: ${data.error}`);
            btn.disabled = false;
            return;
        }

        // Обновляем сохранённое имя
        currentCard.productName = newName;

        // Возвращаем кнопку к исходному виду
        btn.textContent = 'Создать карточку';
        btn.onclick = createCard;
        btn.disabled = true; // Блокируем, т.к. карточка уже создана

        // Блокируем поле
        document.getElementById('productName').disabled = true;

        // Показываем успех
        alert1.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>✅ Название обновлено: "${newName}"</span>
                <button onclick="enableNameEdit()" class="btn-secondary" style="padding: 8px 16px; font-size: 12px;">
                    ✏️ Изменить снова
                </button>
            </div>
        `;
        alert1.classList.remove('hidden');

    } catch (error) {
        loading.classList.remove('active');
        btn.disabled = false;
        alert(`Ошибка соединения: ${error.message}`);
    }
}

// ====================
// BLOCK 2: Product Info (Purpose + Application)
// ====================

// Проверяем заполненность полей и показываем кнопку "Загрузить INCI"
function checkInfoFields() {
    const purpose = document.getElementById('purpose').value.trim();
    const application = document.getElementById('application').value.trim();
    const proceedBtn = document.getElementById('proceedInciBtn');

    if (purpose && application) {
        proceedBtn.classList.remove('hidden');
    } else {
        proceedBtn.classList.add('hidden');
    }
}

// Обработка загрузки файла этикетки (автозагрузка и автозаполнение полей)
async function handleLabelFile() {
    const fileInput = document.getElementById('labelFile');
    const file = fileInput.files[0];

    if (!file) return;

    const preview = document.getElementById('labelPreview');
    const loading = document.getElementById('loading2');
    const results = document.getElementById('labelResults');

    preview.classList.remove('hidden');
    preview.classList.add('has-file');
    preview.innerHTML = `
        <div class="file-item">
            <span class="file-item-name">📋 ${file.name}</span>
        </div>
    `;

    loading.classList.add('active');
    results.classList.add('hidden');

    try {
        const formData = new FormData();
        formData.append('labelFile', file);
        formData.append('cardFolderId', currentCard.cardFolderId);
        formData.append('productName', currentCard.productName);

        const response = await fetch(`/api/cards/${currentCard.cardId}/label`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: formData
        });

        const data = await response.json();

        loading.classList.remove('active');

        if (!data.success) {
            alert(`Ошибка: ${data.error}`);
            return;
        }

        // Автозаполняем поля Назначение и Применение из AI
        if (data.aiSuggestions.purpose) {
            document.getElementById('purpose').value = data.aiSuggestions.purpose;
        }
        if (data.aiSuggestions.application) {
            document.getElementById('application').value = data.aiSuggestions.application;
        }

        // Показываем результаты AI
        const resultContent = document.getElementById('labelResultsContent');
        resultContent.innerHTML = `
            <p><strong>📎 Файл:</strong> ${data.labelFileName}</p>
            <p><strong>🔗 Ссылка:</strong> <a href="${data.labelLink}" target="_blank">Открыть в Drive</a></p>
            ${data.labelInfo ? `<p><strong>ℹ️ Информация:</strong> ${data.labelInfo}</p>` : ''}
            <p style="color: #28a745; margin-top: 10px;">✅ Поля "Назначение" и "Применение" автоматически заполнены</p>
        `;
        results.classList.remove('hidden');

        // Проверяем заполненность полей
        checkInfoFields();

    } catch (error) {
        loading.classList.remove('active');
        alert(`Ошибка соединения: ${error.message}`);
    }
}

// Переход к блоку INCI (с обновлением purpose и application в базе)
async function proceedToInci() {
    const purpose = document.getElementById('purpose').value.trim();
    const application = document.getElementById('application').value.trim();

    if (!purpose || !application) {
        alert('Заполните поля "Назначение" и "Применение"');
        return;
    }

    // Сохраняем в состояние
    currentCard.purpose = purpose;
    currentCard.application = application;

    // Обновляем в Google Sheets через API
    // TODO: добавить отдельный endpoint для обновления purpose/application
    // Пока просто переходим к следующему блоку

    showBlock(3);
}

// ====================
// OLD BLOCK 2: Label Upload (unused now)
// ====================
function setUploadMethod(type, method) {
    uploadMethods[type] = method;

    // Обновляем кнопки
    const parent = event.target.parentElement;
    parent.querySelectorAll('.upload-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    // Показываем соответствующий контрол
    if (type === 'label') {
        const fileInput = document.getElementById('labelFile');
        const preview = document.getElementById('labelPreview');

        if (method === 'file') {
            fileInput.click();
        } else if (method === 'paste') {
            preview.innerHTML = `
                <p style="text-align:center; color: #667eea; font-weight: 600;">
                    Нажмите Ctrl+V для вставки скриншота
                </p>
            `;
            preview.focus();
        } else if (method === 'text') {
            preview.innerHTML = `
                <textarea id="labelTextInput" placeholder="Вставьте текст этикетки..." style="width:100%; min-height: 150px; padding: 15px; border: 2px solid #e0e0e0; border-radius: 10px; font-family: inherit; font-size: 14px;"></textarea>
                <button onclick="uploadLabelText()" class="btn-primary" style="margin-top: 10px;">Отправить</button>
            `;
        } else if (method === 'url') {
            preview.innerHTML = `
                <input type="text" id="labelUrlInput" placeholder="Вставьте ссылку на Google Drive..." style="width:100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 14px; margin-bottom: 10px;">
                <button onclick="uploadLabelUrl()" class="btn-primary">Отправить</button>
            `;
        }
    } else if (type === 'inci') {
        const fileInput = document.getElementById('inciFile');
        const textArea = document.getElementById('inciText');
        const preview = document.getElementById('inciPreview');

        fileInput.style.display = 'none';
        textArea.style.display = 'none';
        preview.innerHTML = '';

        if (method === 'file') {
            fileInput.click();
        } else if (method === 'text') {
            textArea.style.display = 'block';
            preview.style.display = 'none';
        } else if (method === 'paste') {
            preview.innerHTML = `
                <p style="text-align:center; color: #667eea; font-weight: 600;">
                    Нажмите Ctrl+V для вставки скриншота
                </p>
            `;
            preview.style.display = 'block';
        }
    } else if (type === 'photo') {
        const fileInput = document.getElementById('photoFiles');
        const preview = document.getElementById('photoPreview');

        if (method === 'file') {
            fileInput.click();
        } else if (method === 'paste') {
            preview.innerHTML = `
                <p style="text-align:center; color: #667eea; font-weight: 600;">
                    Нажмите Ctrl+V для вставки изображений
                </p>
            `;
            preview.focus();
        }
    }
}

// Обработка загрузки файла этикетки (автозагрузка)
async function handleLabelFile() {
    const fileInput = document.getElementById('labelFile');
    const file = fileInput.files[0];

    if (!file) return;

    const preview = document.getElementById('labelPreview');
    preview.classList.add('has-file');
    preview.innerHTML = `
        <div class="file-item">
            <span class="file-item-name">📋 ${file.name}</span>
            <span class="file-item-remove" onclick="clearLabelFile()">✕</span>
        </div>
    `;

    // Автоматически загружаем
    await uploadLabelFile(file);
}

function clearLabelFile() {
    document.getElementById('labelFile').value = '';
    const preview = document.getElementById('labelPreview');
    preview.classList.remove('has-file');
    preview.innerHTML = `<p style="text-align:center; color: #666;">Выберите способ загрузки</p>`;
}

async function uploadLabelFile(file) {
    const loading = document.getElementById('loading2');
    const results = document.getElementById('labelResults');

    loading.classList.add('active');
    results.classList.add('hidden');

    try {
        const formData = new FormData();
        formData.append('labelFile', file);
        formData.append('cardFolderId', currentCard.cardFolderId);
        formData.append('productName', currentCard.productName);

        const response = await fetch(`/api/cards/${currentCard.cardId}/label`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: formData
        });

        const data = await response.json();

        loading.classList.remove('active');

        if (!data.success) {
            alert(`Ошибка: ${data.error}`);
            return;
        }

        // Показываем результаты через универсальную функцию
        showLabelResults(data);

    } catch (error) {
        loading.classList.remove('active');
        alert(`Ошибка соединения: ${error.message}`);
    }
}

// Показать поле ввода ссылки
function showLabelLinkInput() {
    document.getElementById('labelLinkInput').classList.remove('hidden');
    document.getElementById('labelTextInput').classList.add('hidden');
}

// Показать поле ввода текста
function showLabelTextInput() {
    document.getElementById('labelTextInput').classList.remove('hidden');
    document.getElementById('labelLinkInput').classList.add('hidden');
}

// Вставить из буфера обмена
async function pasteLabelFromClipboard() {
    try {
        const text = await navigator.clipboard.readText();
        if (!text) {
            alert('Буфер обмена пуст');
            return;
        }

        // Показываем поле текста и вставляем содержимое
        showLabelTextInput();
        document.getElementById('labelTextField').value = text;

    } catch (error) {
        alert('Не удалось прочитать буфер обмена. Используйте кнопку "Текст" и вставьте вручную (Ctrl+V).');
    }
}

// Обработка ссылки на этикетку
async function handleLabelFromLink() {
    const url = document.getElementById('labelLinkField').value.trim();
    if (!url) {
        alert('Введите ссылку на файл');
        return;
    }

    const loading = document.getElementById('loading2');
    const results = document.getElementById('labelResults');

    loading.classList.add('active');
    results.classList.add('hidden');

    try {
        // Отправляем ссылку на сервер
        const response = await fetch(`/api/cards/${currentCard.cardId}/label-url`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify({
                labelUrl: url,
                cardFolderId: currentCard.cardFolderId,
                productName: currentCard.productName
            })
        });

        const data = await response.json();
        loading.classList.remove('active');

        if (!data.success) {
            alert(`Ошибка: ${data.error || 'Загрузка по ссылке пока не поддерживается. Скачайте файл и загрузите напрямую.'}`);
            return;
        }

        // Показываем результаты
        showLabelResults(data);

        // Скрываем поле ввода
        document.getElementById('labelLinkInput').classList.add('hidden');
        document.getElementById('labelLinkField').value = '';

    } catch (error) {
        loading.classList.remove('active');
        alert('Ошибка: Загрузка по ссылке пока не реализована на сервере. Скачайте файл и загрузите напрямую.');
    }
}

// Обработка текста этикетки
async function handleLabelFromText() {
    const text = document.getElementById('labelTextField').value.trim();
    if (!text) {
        alert('Введите текст этикетки');
        return;
    }

    const loading = document.getElementById('loading2');
    const results = document.getElementById('labelResults');

    loading.classList.add('active');
    results.classList.add('hidden');

    try {
        // Отправляем текст на сервер для AI обработки
        const response = await fetch(`/api/cards/${currentCard.cardId}/label-text`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify({
                labelText: text,
                productName: currentCard.productName
            })
        });

        const data = await response.json();
        loading.classList.remove('active');

        if (!data.success) {
            alert(`Ошибка: ${data.error || 'Обработка текста пока не поддерживается полностью.'}`);
            return;
        }

        // Показываем результаты AI
        showLabelResults(data);

        // Скрываем поле ввода
        document.getElementById('labelTextInput').classList.add('hidden');
        document.getElementById('labelTextField').value = '';

    } catch (error) {
        loading.classList.remove('active');
        alert('Ошибка: Обработка текста пока не реализована на сервере. Используйте загрузку файла.');
    }
}

// Универсальная функция показа результатов этикетки
function showLabelResults(data) {
    const resultContent = document.getElementById('labelResultsContent');
    const results = document.getElementById('labelResults');

    resultContent.innerHTML = `
        ${data.labelFileName ? `<p><strong>📎 Файл:</strong> ${data.labelFileName}</p>` : ''}
        ${data.labelLink ? `<p><strong>🔗 Ссылка:</strong> <a href="${data.labelLink}" target="_blank">Открыть в Drive</a></p>` : ''}
        ${data.labelInfo ? `<p><strong>ℹ️ Информация:</strong> ${data.labelInfo}</p>` : ''}
        ${data.aiSuggestions?.purpose ? `<p><strong>💡 Назначение:</strong> ${data.aiSuggestions.purpose}</p>` : ''}
        ${data.aiSuggestions?.application ? `<p><strong>💡 Применение:</strong> ${data.aiSuggestions.application}</p>` : ''}
    `;
    results.classList.remove('hidden');

    // Автозаполнение полей если есть данные
    if (data.aiSuggestions?.purpose) {
        document.getElementById('purpose').value = data.aiSuggestions.purpose;
    }
    if (data.aiSuggestions?.application) {
        document.getElementById('application').value = data.aiSuggestions.application;
    }

    // Проверяем и показываем кнопку "Загрузить INCI"
    checkInfoFields();
}

// ====================
// BLOCK 3: INCI Upload
// ====================
function handleInciFile() {
    const fileInput = document.getElementById('inciFile');
    const file = fileInput.files[0];

    if (!file) return;

    const preview = document.getElementById('inciPreview');
    preview.classList.add('has-file');
    preview.innerHTML = `
        <div class="file-item">
            <span class="file-item-name">📄 ${file.name}</span>
            <span class="file-item-remove" onclick="clearInciFile()">✕</span>
        </div>
    `;
}

function clearInciFile() {
    document.getElementById('inciFile').value = '';
    const preview = document.getElementById('inciPreview');
    preview.classList.remove('has-file');
    preview.innerHTML = `<p style="text-align:center; color: #666;">Выберите способ загрузки</p>`;
}

async function uploadInci() {
    if (!checkAuth()) return;

    const fileInput = document.getElementById('inciFile');
    const textArea = document.getElementById('inciText');

    let file = fileInput.files[0];
    let inciText = textArea.value.trim();

    if (!file && !inciText) {
        alert('Загрузите файл INCI или введите текст состава');
        return;
    }

    const loading = document.getElementById('loading3');
    const results = document.getElementById('inciResults');
    const btn = document.getElementById('uploadInciBtn');

    btn.disabled = true;
    loading.classList.add('active');
    results.classList.add('hidden');

    try {
        const formData = new FormData();

        if (file) {
            formData.append('inciFile', file);
        } else {
            // Создаем текстовый файл из введённого текста
            const blob = new Blob([inciText], { type: 'text/plain' });
            formData.append('inciFile', blob, 'inci-text.txt');
        }

        formData.append('cardFolderId', currentCard.cardFolderId);
        formData.append('productName', currentCard.productName);
        formData.append('purpose', currentCard.purpose);

        const response = await fetch(`/api/cards/${currentCard.cardId}/inci`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: formData
        });

        const data = await response.json();

        loading.classList.remove('active');
        btn.disabled = false;

        if (!data.success) {
            alert(`Ошибка: ${data.error}`);
            return;
        }

        // Заполняем результаты AI
        const aiResults = data.aiResults;

        // Полный состав (4 таба)
        document.getElementById('full-ru').textContent = aiResults.fullComposition.ru || 'Нет данных';
        document.getElementById('full-ru-percent').textContent = aiResults.fullComposition.ru || 'Нет данных'; // TODO: с процентами
        document.getElementById('full-en').textContent = aiResults.fullComposition.en || 'Нет данных';
        document.getElementById('full-en-percent').textContent = aiResults.fullComposition.en || 'Нет данных'; // TODO: с процентами

        // Активные ингредиенты (2 таба)
        document.getElementById('active-ru').textContent = aiResults.activeIngredients.ru || 'Нет данных';
        document.getElementById('active-en').textContent = aiResults.activeIngredients.en || 'Нет данных';

        // Описание для буклета (2 таба)
        document.getElementById('booklet-ru').textContent = aiResults.bookletComposition.ru || 'Нет данных';
        document.getElementById('booklet-en').textContent = aiResults.bookletComposition.en || 'Нет данных';

        results.classList.remove('hidden');

        // Переходим к следующему блоку через 2 секунды
        setTimeout(() => {
            showBlock(4);
        }, 2000);

    } catch (error) {
        loading.classList.remove('active');
        btn.disabled = false;
        alert(`Ошибка соединения: ${error.message}`);
    }
}

// ====================
// BLOCK 4: Photos Upload
// ====================
function handlePhotoFiles() {
    const fileInput = document.getElementById('photoFiles');
    const files = fileInput.files;

    if (files.length === 0) return;

    const preview = document.getElementById('photoPreview');
    preview.classList.add('has-file');
    preview.innerHTML = '';

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        preview.innerHTML += `
            <div class="file-item">
                <span class="file-item-name">🖼️ ${file.name}</span>
                <span class="file-item-remove" onclick="removePhoto(${i})">✕</span>
            </div>
        `;
    }
}

function removePhoto(index) {
    const input = document.getElementById('photoFiles');
    const dt = new DataTransfer();
    const files = input.files;

    for (let i = 0; i < files.length; i++) {
        if (i !== index) {
            dt.items.add(files[i]);
        }
    }

    input.files = dt.files;
    handlePhotoFiles();
}

async function uploadPhotos() {
    if (!checkAuth()) return;

    const fileInput = document.getElementById('photoFiles');
    const files = fileInput.files;

    if (files.length === 0) {
        alert('Выберите фотографии для загрузки');
        return;
    }

    const loading = document.getElementById('loading4');
    const alert4 = document.getElementById('alert4');
    const btn = document.getElementById('uploadPhotosBtn');

    btn.disabled = true;
    loading.classList.add('active');
    alert4.classList.add('hidden');

    try {
        const formData = new FormData();

        for (let i = 0; i < files.length; i++) {
            formData.append('photos', files[i]);
        }

        formData.append('photosFolderId', currentCard.photosFolderId);

        const response = await fetch(`/api/cards/${currentCard.cardId}/photos`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: formData
        });

        const data = await response.json();

        loading.classList.remove('active');
        btn.disabled = false;

        if (!data.success) {
            alert(`Ошибка: ${data.error}`);
            return;
        }

        // Показываем успех
        alert4.textContent = `✅ Загружено ${data.count} фото`;
        alert4.classList.remove('hidden');

        // Переходим к финальному блоку через 1.5 секунды
        setTimeout(() => {
            showBlock(5);
        }, 1500);

    } catch (error) {
        loading.classList.remove('active');
        btn.disabled = false;
        alert(`Ошибка соединения: ${error.message}`);
    }
}

// ====================
// Tab Switching для AI результатов
// ====================
function showTab(group, lang) {
    const tabsContainer = event.target.parentElement;
    const tabs = tabsContainer.querySelectorAll('.tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    event.target.classList.add('active');

    // Скрываем все контенты этой группы
    const allContents = document.querySelectorAll(`[id^="${group}-"]`);
    allContents.forEach(content => content.classList.remove('active'));

    // Показываем нужный контент
    document.getElementById(`${group}-${lang}`).classList.add('active');
}

// ====================
// Paste from Clipboard (Ctrl+V)
// ====================
document.addEventListener('DOMContentLoaded', function() {
    // Обработчики для полей Назначение и Применение (Блок 2)
    const purposeField = document.getElementById('purpose');
    const applicationField = document.getElementById('application');

    if (purposeField) {
        purposeField.addEventListener('input', checkInfoFields);
    }
    if (applicationField) {
        applicationField.addEventListener('input', checkInfoFields);
    }

    // Label preview paste
    const labelPreview = document.getElementById('labelPreview');
    labelPreview.setAttribute('tabindex', '0');
    labelPreview.addEventListener('paste', async function(e) {
        if (uploadMethods.label !== 'paste') return;

        e.preventDefault();
        const items = e.clipboardData.items;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.indexOf('image') !== -1) {
                const blob = item.getAsFile();
                const fileName = `label-pasted-${Date.now()}.png`;
                const file = new File([blob], fileName, { type: blob.type });

                // Показываем превью
                labelPreview.classList.add('has-file');
                labelPreview.innerHTML = `
                    <div class="file-item">
                        <span class="file-item-name">📋 ${fileName} (из буфера)</span>
                        <span class="file-item-remove" onclick="clearLabelFile()">✕</span>
                    </div>
                `;

                // Автоматически загружаем
                await uploadLabelFile(file);
                return;
            }
        }

        alert('В буфере обмена нет изображения. Сделайте скриншот и попробуйте снова.');
    });

    // INCI preview paste
    const inciPreview = document.getElementById('inciPreview');
    inciPreview.setAttribute('tabindex', '0');
    inciPreview.addEventListener('paste', function(e) {
        if (uploadMethods.inci !== 'paste') return;

        e.preventDefault();
        const items = e.clipboardData.items;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.indexOf('image') !== -1) {
                const blob = item.getAsFile();
                const fileName = `inci-pasted-${Date.now()}.png`;
                const file = new File([blob], fileName, { type: blob.type });

                // Устанавливаем в input
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                document.getElementById('inciFile').files = dataTransfer.files;

                // Показываем превью
                inciPreview.classList.add('has-file');
                inciPreview.innerHTML = `
                    <div class="file-item">
                        <span class="file-item-name">📄 ${fileName} (из буфера)</span>
                        <span class="file-item-remove" onclick="clearInciFile()">✕</span>
                    </div>
                `;
                return;
            }
        }

        alert('В буфере обмена нет изображения. Сделайте скриншот и попробуйте снова.');
    });

    // Photo preview paste
    const photoPreview = document.getElementById('photoPreview');
    photoPreview.setAttribute('tabindex', '0');
    photoPreview.addEventListener('paste', function(e) {
        if (uploadMethods.photo !== 'paste') return;

        e.preventDefault();
        const items = e.clipboardData.items;
        const existingFiles = document.getElementById('photoFiles').files;
        const dataTransfer = new DataTransfer();

        // Добавляем существующие файлы
        for (let i = 0; i < existingFiles.length; i++) {
            dataTransfer.items.add(existingFiles[i]);
        }

        // Добавляем новые из буфера
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.indexOf('image') !== -1) {
                const blob = item.getAsFile();
                const fileName = `photo-pasted-${Date.now()}.png`;
                const file = new File([blob], fileName, { type: blob.type });
                dataTransfer.items.add(file);
            }
        }

        document.getElementById('photoFiles').files = dataTransfer.files;
        handlePhotoFiles();
    });
});

console.log('✅ App.js loaded successfully');
