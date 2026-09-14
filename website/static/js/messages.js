let messageUpdateInterval = null;
let isLoadingMessages = false;

function startMessageAutoUpdate() {
    if (messageUpdateInterval) {
        clearInterval(messageUpdateInterval);
    }

    messageUpdateInterval = setInterval(() => {
        loadMessages();
    }, 30000);

    loadMessages();
}

function stopMessageAutoUpdate() {
    if (messageUpdateInterval) {
        clearInterval(messageUpdateInterval);
        messageUpdateInterval = null;
    }
}

function showMessageLoading() {
    const container = document.getElementById('messagesContainer');
    if (!container) return;

    const existingLoader = container.querySelector('.message-loader');
    if (existingLoader) return;

    const loaderDiv = document.createElement('div');
    loaderDiv.className = 'message-loader';
    loaderDiv.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; gap: 16px;">
            <div class="loader-pulse-small"></div>
            <div class="loading-text">Загрузка сообщений...</div>
        </div>
    `;

    const messages = container.querySelectorAll('.mes:not(.message-loader)');
    if (messages.length === 0 || container.querySelector('.mes.empty')) {
        container.innerHTML = '';
        container.appendChild(loaderDiv);
    } else {
        const firstMessage = container.querySelector('.mes');
        if (firstMessage) {
            container.insertBefore(loaderDiv, firstMessage);
        } else {
            container.appendChild(loaderDiv);
        }
    }
}

function hideMessageLoading() {
    const loader = document.querySelector('.message-loader');
    if (loader) {
        loader.remove();
    }
}

function loadMessages() {
    if (isLoadingMessages) return;

    isLoadingMessages = true;
    showMessageLoading();

    fetch('/api/messages', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            updateMessagesContainer(data.messages, data.count);
        } else {
            console.error('Ошибка загрузки сообщений:', data.error);
        }
    })
    .catch(error => {
        console.error('Ошибка:', error);
    })
    .finally(() => {
        isLoadingMessages = false;
        hideMessageLoading();
    });
}

// Личный почтовый ящик — только на чтение. Переписка с администратором
// (обращения "к администратору" и ответы на них) ведётся в отдельной
// админ-панели (/admin, панель "Сообщения администратору"), здесь остаются
// только личные уведомления пользователю (смена статуса отчёта и т.п.).
function updateMessagesContainer(messages, totalCount) {
    const container = document.getElementById('messagesContainer');
    if (!container) return;

    if (messages.length === 0) {
        container.innerHTML = `
            <div class="mes empty">
                <div class="text_mes">Нет сообщений</div>
            </div>
        `;
        updateMessageCount(0);
        return;
    }

    const messagesHtml = messages.map(msg => {
        const dateParts = msg.create_time.split(' ');
        const date = dateParts[0] || '';
        const time = dateParts[1] || '';
        return `
        <div class="mes ${msg.is_read ? 'read' : 'unread'}" id="message-${msg.id}">
            <div class="message_header">
                <div class="time_mes">
                    <span class="msg-date">${date}</span>
                    <span class="msg-time">${time}</span>
                    <span class="sender">Администратор</span>
                </div>
            </div>
            <div class="text_mes">${escapeHtml(msg.text)}</div>
        </div>
    `}).join('');

    container.innerHTML = messagesHtml;
    updateMessageCount(totalCount);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateMessageCount(count) {
    const countElement = document.getElementById('messageCount');
    if (countElement) {
        countElement.textContent = count;
        if (count === 0) {
            countElement.style.display = 'none';
        } else {
            countElement.style.display = 'inline-flex';
        }
    }
}

document.addEventListener('DOMContentLoaded', function() {
    loadMessages();
});
