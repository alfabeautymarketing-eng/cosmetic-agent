// Клиентская логика авторизации

// Auth state
let currentUser = null;
let authToken = null;

// Проверка авторизации при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});

/**
 * Проверяет, авторизован ли пользователь
 */
async function checkAuth() {
    const token = localStorage.getItem('authToken');

    if (!token) {
        showAuthButtons();
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
        } else {
            localStorage.removeItem('authToken');
            showAuthButtons();
        }
    } catch (error) {
        console.error('Ошибка проверки токена:', error);
        localStorage.removeItem('authToken');
        showAuthButtons();
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
