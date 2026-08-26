let messageUpdateInterval = null;
let isLoadingMessages = false;
const currentUserIsAdmin = document.querySelector('meta[name="user-is-admin"]')?.content === 'true';

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
    
    const isAdmin = currentUserIsAdmin;

    const messagesHtml = messages.map(msg => {
        const dateParts = msg.create_time.split(' ');
        const date = dateParts[0] || '';
        const time = dateParts[1] || '';

        const senderName = msg.sender ? (msg.sender.fio || msg.sender.email) : '';
        const senderPhone = msg.sender ? msg.sender.telephone : '';
        const senderEmail = msg.sender ? msg.sender.email : '';
        const senderIsAdmin = msg.sender ? msg.sender.is_admin : false;
        
        return `
        <div class="mes ${msg.is_read ? 'read' : 'unread'}" id="message-${msg.id}">
            <div class="message_header">
                <div class="time_mes">
                    <span class="msg-date">${date}</span>
                    <span class="msg-time">${time}</span>
                    ${msg.sender_id && isAdmin ? `- <span class="sender">${senderIsAdmin ? 'Система' : escapeHtml(senderEmail)}</span>` : ''}
                </div>
                <div class="message_actions">
                    ${isAdmin && !msg.is_read ? `
                    <button class="mark-read-btn" 
                            onclick="markMessageAsRead(${msg.id})"
                            title="Отметить как прочитанное">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:16px; height:16px;">
                            <path stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75L9 17.25L19.5 6.75"/>
                        </svg>
                    </button>
                    ` : ''}
                    ${msg.can_reply && isAdmin ? `
                    <button class="reply_btn" 
                            onclick="showReplyForm(${msg.id}, '${senderIsAdmin ? 'Администратор' : escapeHtml(senderEmail)}', '${escapeHtml(senderName)}', '${senderPhone}')"
                            title="Ответить">
                        Ответить
                    </button>
                    ` : ''}
                </div>
            </div>
            <div class="text_mes">${escapeHtml(msg.text)}</div>
            <div class="reply_form" id="replyForm-${msg.id}" style="display: none;">
                <div class="reply_info">
                    <div class="reply_recipient">
                        <span class="reply_label">Кому:</span>
                        <span class="reply_name">${escapeHtml(senderName || senderEmail)}</span>
                        ${senderPhone ? `<span class="reply_phone">(${escapeHtml(senderPhone)})</span>` : ''}
                        ${senderEmail && senderEmail !== senderName ? `<span class="reply_email">${escapeHtml(senderEmail)}</span>` : ''}
                    </div>
                </div>
                <textarea class="reply_textarea" 
                        id="replyText-${msg.id}" 
                        placeholder="Введите ваш ответ..." 
                        rows="3"></textarea>
                <div class="reply_actions">
                    <button class="reply_submit_btn" onclick="submitReply(${msg.id})">Отправить</button>
                    <button class="reply_cancel_btn" onclick="cancelReply(${msg.id})">Отмена</button>
                </div>
            </div>
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

function markMessageAsRead(messageId) {
    const isAdmin = currentUserIsAdmin;
    if (!isAdmin) {
        console.log('Только администратор может отмечать сообщения как прочитанные');
        return;
    }
    
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
    if (!csrfToken) {
        console.error('CSRF токен не найден');
        return;
    }
    
    fetch(`/api/mark_read/${messageId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            loadMessages();
        } else {
            console.error('Ошибка:', data.error);
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}

function showReplyForm(messageId, recipientEmail, recipientName, recipientPhone) {
    const isAdmin = currentUserIsAdmin;
    if (!isAdmin) return;
    
    document.querySelectorAll('.reply_form').forEach(form => {
        if (form) {
            form.style.display = 'none';
        }
    });
    
    const replyForm = document.getElementById(`replyForm-${messageId}`);
    const textarea = document.getElementById(`replyText-${messageId}`);
    
    if (replyForm && textarea) {
        replyForm.style.display = 'block';
        textarea.value = '';
        
        const nameDisplay = recipientName || recipientEmail;
        const phoneDisplay = recipientPhone ? ` (${recipientPhone})` : '';
        const emailDisplay = recipientEmail && recipientEmail !== recipientName ? ` <${recipientEmail}>` : '';
        
        
        textarea.focus();
        replyForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function cancelReply(messageId) {
    const replyForm = document.getElementById(`replyForm-${messageId}`);
    const textarea = document.getElementById(`replyText-${messageId}`);
    
    if (replyForm && textarea) {
        textarea.value = '';
        replyForm.style.display = 'none';
    }
}

function submitReply(messageId) {
    const isAdmin = currentUserIsAdmin;
    if (!isAdmin) return;
    
    const textarea = document.getElementById(`replyText-${messageId}`);
    if (!textarea) return;
    
    const replyText = textarea.value.trim();
    if (!replyText) {
        alert('Введите текст ответа');
        return;
    }
    
    const submitBtn = document.querySelector(`#replyForm-${messageId} .reply_submit_btn`);
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
    
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Отправка...';
    }
    
    fetch(`/reply_to_message/${messageId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken
        },
        body: JSON.stringify({
            text: replyText
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            textarea.value = '';
            const replyForm = document.getElementById(`replyForm-${messageId}`);
            if (replyForm) {
                replyForm.style.display = 'none';
            }
            loadMessages();
        } else {
            alert(data.error || 'Ошибка при отправке ответа');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Ошибка при отправке ответа');
    })
    .finally(() => {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Отправить';
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    loadMessages();
});