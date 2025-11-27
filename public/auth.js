// Клиентская логика авторизации

// Auth state
let currentUser = null;
let authToken = null;

// Проверка авторизации при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    // Проверка автоматического входа для тестирования
    const urlParams = new URLSearchParams(window.location.search);
    const testUser = urlParams.get('testuser');
    const autoLoginEmail = localStorage.getItem('autoLoginEmail') || 'alfabeautymarketing@gmail.com';

    if (testUser === '1' && !localStorage.getItem('authToken')) {
        console.log('🧪 Test mode: Auto-login с', autoLoginEmail);
        await autoLogin(autoLoginEmail);
    } else {
        await checkAuth();
    }
});

/**
 * Проверяет, авторизован ли пользователь
 */
async function checkAuth() {
    const token = localStorage.getItem('authToken');

    if (!token) {
        showAuthButtons();
        blockFormUntilAuth(); // Блокируем форму до авторизации
        return;
    }

    try {
        const response = await fetch('/api/auth/verify-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token })
        });

        const data = await response.json();

        if (data.success) {
            authToken = token;
            currentUser = data.user;
            showUserMenu();
            unblockForm(); // Разблокируем форму после успешной авторизации
        } else {
            localStorage.removeItem('authToken');
            showAuthButtons();
            blockFormUntilAuth(); // Блокируем форму
        }
    } catch (error) {
        console.error('Ошибка проверки токена:', error);
        localStorage.removeItem('authToken');
        showAuthButtons();
        blockFormUntilAuth(); // Блокируем форму
    }
}

/**
 * Автоматический вход для тестирования
 * Используется при открытии страницы с ?testuser=1
 */
async function autoLogin(email) {
    console.log('🧪 Начинаем автоматический вход для:', email);

    try {
        // Шаг 1: Запросить код
        const loginResponse = await fetch('/api/auth/login/email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });

        const loginData = await loginResponse.json();

        if (!loginData.success) {
            console.error('❌ Ошибка запроса кода:', loginData.error);
            await checkAuth();
            return;
        }

        // Получаем код (в development mode сервер возвращает код)
        const code = loginData.code;

        if (!code) {
            console.error('❌ Код не получен (возможно, production mode). Используйте ручной вход.');
            await checkAuth();
            return;
        }

        console.log('✅ Код получен:', code);

        // Шаг 2: Подождать 500мс (имитация задержки пользователя)
        await new Promise(resolve => setTimeout(resolve, 500));

        // Шаг 3: Верифицировать код
        const verifyResponse = await fetch('/api/auth/register/email/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, code: code.toString() })
        });

        const verifyData = await verifyResponse.json();

        if (!verifyData.success) {
            console.error('❌ Ошибка верификации:', verifyData.error);
            await checkAuth();
            return;
        }

        // Шаг 4: Сохранить токен
        localStorage.setItem('authToken', verifyData.token);
        authToken = verifyData.token;
        currentUser = verifyData.user;

        console.log('✅ Автоматический вход выполнен!', currentUser);
        showUserMenu();
        unblockForm(); // Разблокируем форму после автологина

    } catch (error) {
        console.error('❌ Ошибка автологина:', error);
        await checkAuth();
    }
}

/**
 * Показывает кнопки авторизации
 */
function showAuthButtons() {
    const authButtons = document.getElementById('authButtons');
    const userMenu = document.getElementById('userMenu');

    if (authButtons) authButtons.classList.remove('hidden');
    if (userMenu) userMenu.classList.add('hidden');
}

/**
 * Показывает меню пользователя
 */
function showUserMenu() {
    const authButtons = document.getElementById('authButtons');
    const userMenu = document.getElementById('userMenu');

    if (authButtons) authButtons.classList.add('hidden');
    if (userMenu) userMenu.classList.remove('hidden');

    if (currentUser) {
        const initials = currentUser.name
            ? currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase()
            : '';

        const avatarEl = document.getElementById('userAvatar');
        const userNameEl = document.getElementById('userName');

        if (avatarEl && initials) {
            avatarEl.textContent = initials;
        }

        if (userNameEl) {
            userNameEl.textContent = currentUser.name || '';
        }

        // Заполняем поля формы (проверяем существование элементов)
        const userEmailField = document.getElementById('userEmail');
        const userNameField = document.getElementById('userName');

        if (userEmailField) {
            userEmailField.value = currentUser.email;
            userEmailField.readOnly = true;
        }

        if (userNameField) {
            userNameField.value = currentUser.name;
            userNameField.readOnly = true;
        }
    }
}

/**
 * Открывает модальное окно входа
 */
function openLoginModal() {
    document.getElementById('loginModal').classList.add('active');
}

/**
 * Открывает модальное окно регистрации
 */
function openRegisterModal() {
    document.getElementById('registerModal').classList.add('active');
}

/**
 * Закрывает модальное окно
 */
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    // Сброс форм
    if (modalId === 'loginModal') {
        document.getElementById('loginEmailForm').reset();
        document.getElementById('loginVerificationForm').classList.add('hidden');
        document.getElementById('loginEmailForm').classList.remove('hidden');
    } else if (modalId === 'registerModal') {
        document.getElementById('registerEmailForm').reset();
        document.getElementById('registerVerificationForm').classList.add('hidden');
        document.getElementById('registerEmailForm').classList.remove('hidden');
    }
}

/**
 * Выход из системы
 */
function logout() {
    localStorage.removeItem('authToken');
    authToken = null;
    currentUser = null;
    showAuthButtons();

    // Очищаем форму (проверяем существование элементов)
    const userEmailField = document.getElementById('userEmail');
    const userNameField = document.getElementById('userName');

    if (userEmailField) {
        userEmailField.value = '';
        userEmailField.readOnly = false;
    }

    if (userNameField) {
        userNameField.value = '';
        userNameField.readOnly = false;
    }
}

/**
 * Регистрация через email - отправка кода
 */
async function registerWithEmail(event) {
    event.preventDefault();

    const email = document.getElementById('registerEmail').value;
    const name = document.getElementById('registerName').value;
    const submitBtn = event.target.querySelector('button[type="submit"]');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Отправка...';

    try {
        const response = await fetch('/api/auth/register/email/send-code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, name })
        });

        const data = await response.json();

        if (data.success) {
            // Показываем форму ввода кода
            document.getElementById('registerEmailForm').classList.add('hidden');
            document.getElementById('registerVerificationForm').classList.remove('hidden');
            document.getElementById('registerVerificationEmail').textContent = email;

            // В dev mode показываем код
            if (data.code) {
                alert(`Код для разработки: ${data.code}`);
            }
        } else {
            alert('Ошибка: ' + data.error);
        }
    } catch (error) {
        alert('Ошибка соединения: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Получить код';
    }
}

/**
 * Подтверждение кода регистрации
 */
async function verifyRegistrationCode(event) {
    event.preventDefault();

    const email = document.getElementById('registerEmail').value;
    const code = ['code1', 'code2', 'code3', 'code4', 'code5', 'code6']
        .map(id => document.getElementById(id).value)
        .join('');

    const submitBtn = event.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Проверка...';

    try {
        const response = await fetch('/api/auth/register/email/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, code })
        });

        const data = await response.json();

        if (data.success) {
            // Сохраняем токен
            localStorage.setItem('authToken', data.token);
            authToken = data.token;
            currentUser = data.user;

            // Закрываем модалку и показываем меню
            closeModal('registerModal');
            showUserMenu();

            alert('Регистрация успешна!');
        } else {
            alert('Ошибка: ' + data.error);
        }
    } catch (error) {
        alert('Ошибка соединения: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Подтвердить';
    }
}

/**
 * Вход через email - отправка кода
 */
async function loginWithEmail(event) {
    event.preventDefault();

    const email = document.getElementById('loginEmail').value;
    const submitBtn = event.target.querySelector('button[type="submit"]');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Отправка...';

    try {
        const response = await fetch('/api/auth/login/email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (data.success) {
            // Показываем форму ввода кода
            document.getElementById('loginEmailForm').classList.add('hidden');
            document.getElementById('loginVerificationForm').classList.remove('hidden');
            document.getElementById('loginVerificationEmail').textContent = email;

            // В dev mode показываем код
            if (data.code) {
                alert(`Код для разработки: ${data.code}`);
            }
        } else {
            alert('Ошибка: ' + data.error);
        }
    } catch (error) {
        alert('Ошибка соединения: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Получить код';
    }
}

/**
 * Подтверждение кода входа
 */
async function verifyLoginCode(event) {
    event.preventDefault();

    const email = document.getElementById('loginEmail').value;
    const code = ['loginCode1', 'loginCode2', 'loginCode3', 'loginCode4', 'loginCode5', 'loginCode6']
        .map(id => document.getElementById(id).value)
        .join('');

    const submitBtn = event.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Проверка...';

    try {
        const response = await fetch('/api/auth/register/email/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, code })
        });

        const data = await response.json();

        if (data.success) {
            // Сохраняем токен
            localStorage.setItem('authToken', data.token);
            authToken = data.token;
            currentUser = data.user;

            // Закрываем модалку и показываем меню
            closeModal('loginModal');
            showUserMenu();

            alert('Вход выполнен!');
        } else {
            alert('Ошибка: ' + data.error);
        }
    } catch (error) {
        alert('Ошибка соединения: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Войти';
    }
}

/**
 * Автофокус на следующем поле ввода кода
 */
function setupCodeInputs(formId, fieldPrefix) {
    for (let i = 1; i <= 6; i++) {
        const input = document.getElementById(fieldPrefix + i);

        input.addEventListener('input', (e) => {
            if (e.target.value.length === 1 && i < 6) {
                document.getElementById(fieldPrefix + (i + 1)).focus();
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && e.target.value === '' && i > 1) {
                document.getElementById(fieldPrefix + (i - 1)).focus();
            }
        });
    }
}

// Настройка полей ввода кода при загрузке
document.addEventListener('DOMContentLoaded', () => {
    setupCodeInputs('registerVerificationForm', 'code');
    setupCodeInputs('loginVerificationForm', 'loginCode');
});

/**
 * Блокирует форму создания карточки до авторизации
 */
function blockFormUntilAuth() {
    const productNameInput = document.getElementById('productName');
    const createCardBtn = document.getElementById('createCardBtn');
    const formContainer = document.querySelector('.form-container');

    // Блокируем поле ввода
    if (productNameInput) {
        productNameInput.disabled = true;
        productNameInput.placeholder = '🔒 Войдите, чтобы создать карточку';
    }

    // Блокируем кнопку
    if (createCardBtn) {
        createCardBtn.disabled = true;
        createCardBtn.style.opacity = '0.5';
        createCardBtn.style.cursor = 'not-allowed';
    }

    // Добавляем уведомление
    if (formContainer && !document.getElementById('authWarning')) {
        const warning = document.createElement('div');
        warning.id = 'authWarning';
        warning.style.cssText = `
            background: #fff3cd;
            border: 2px solid #ffc107;
            border-radius: 15px;
            padding: 20px;
            margin-bottom: 20px;
            text-align: center;
            font-weight: 600;
            color: #856404;
        `;
        warning.innerHTML = `
            🔒 Для создания карточки необходимо авторизоваться<br>
            <button onclick="openLoginModal()" style="margin-top: 10px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                Войти
            </button>
        `;
        formContainer.insertBefore(warning, formContainer.firstChild);
    }
}

/**
 * Разблокирует форму после успешной авторизации
 */
function unblockForm() {
    const productNameInput = document.getElementById('productName');
    const createCardBtn = document.getElementById('createCardBtn');
    const authWarning = document.getElementById('authWarning');

    // Разблокируем поле ввода
    if (productNameInput) {
        productNameInput.disabled = false;
        productNameInput.placeholder = 'Например: Крем увлажняющий для лица';
    }

    // Разблокируем кнопку
    if (createCardBtn) {
        createCardBtn.disabled = false;
        createCardBtn.style.opacity = '1';
        createCardBtn.style.cursor = 'pointer';
    }

    // Удаляем уведомление
    if (authWarning) {
        authWarning.remove();
    }
}
