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

function updateMessagesContainer(messages, totalCount) {
    const container = document.getElementById('messagesContainer');
    if (!container) return;
    
    if (messages.length === 0) {
        container.innerHTML = `
            <div class="mes empty">
                <div class="text_mes">Нет уведомлений</div>
            </div>
        `;
        updateMessageCount(0);
        return;
    }
    
    const messagesHtml = messages.map(msg => `
        <div class="mes" id="message-${msg.id}">
            <div class="message_header">
                <div class="time_mes">
                    ${msg.create_time}
                    ${msg.sender_id ? `- <span class="sender">${msg.sender_type === "Администратор" ? 'Система' : escapeHtml(msg.sender_email)}</span>` : ''}
                </div>
                <div class="message_actions">
                    ${msg.can_reply ? `
                    <button class="reply_btn" 
                            onclick="showReplyForm(${msg.id}, '${msg.sender_type === 'Администратор' ? 'Администратор' : escapeHtml(msg.sender_email)}')"
                            title="Ответить">
                        Ответить
                    </button>
                    ` : ''}
                    <button class="delete_btn" 
                            onclick="deleteMessage(${msg.id})"
                            title="Удалить сообщение">
                        ✕
                    </button>
                </div>
            </div>
            <div class="text_mes">${escapeHtml(msg.text)}</div>
            <div class="reply_form" id="replyForm-${msg.id}" style="display: none;">
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
    `).join('');
    
    container.innerHTML = messagesHtml;
    updateMessageCount(totalCount);
}

function escapeHtml(text) {
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
    
    let deleteAllForm = document.querySelector('.account_messageArea form');
    if (!deleteAllForm) {
        const accountMessageArea = document.querySelector('.account_messageArea');
        if (accountMessageArea && count > 0) {
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = '/delete_all_message';
            form.innerHTML = `
                <input type="hidden" name="csrf_token" value="${document.querySelector('meta[name="csrf-token"]').getAttribute('content')}">
                <button type="submit" class="print-btn delete">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"></path>
                    </svg>
                    <span>Удалить все</span>
                </button>
            `;
            accountMessageArea.appendChild(form);
            deleteAllForm = form;
        }
    }
    
    if (deleteAllForm) {
        if (count === 0) {
            deleteAllForm.style.display = 'none';
        } else {
            deleteAllForm.style.display = 'block';
        }
    }
}

function performDeletion(messageId, messageElement, deleteBtn, originalText, cancelBtn) {
    if (cancelBtn && cancelBtn.parentNode) {
        cancelBtn.remove();
    }
    
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
    
    fetch(`/delete_message/${messageId}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            messageElement.style.transition = 'all 0.3s ease';
            messageElement.style.height = messageElement.offsetHeight + 'px';
            
            setTimeout(() => {
                messageElement.style.height = '0';
                messageElement.style.padding = '0';
                messageElement.style.margin = '0';
                messageElement.style.opacity = '0';
                messageElement.style.border = 'none';
                messageElement.style.overflow = 'hidden';
                
                setTimeout(() => {
                    messageElement.remove();
                    loadMessages();
                }, 300);
            }, 50);
        } else {
            resetDeleteButton(deleteBtn, originalText);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        resetDeleteButton(deleteBtn, originalText);
    });
}

function deleteMessage(messageId) {
    const messageElement = document.getElementById(`message-${messageId}`);
    if (!messageElement) return;
    
    const deleteBtn = messageElement.querySelector('.delete_btn');
    const messageActions = messageElement.querySelector('.message_actions');
    
    const originalText = deleteBtn.innerHTML;
    
    deleteBtn.disabled = true;
    deleteBtn.innerHTML = 'Удаление...';
    deleteBtn.style.opacity = '0.5';
    deleteBtn.style.cursor = 'default';
    
    let secondsLeft = 5;
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'cancel_btn';
    cancelBtn.innerHTML = `Отмена (${secondsLeft})`;
    cancelBtn.style.marginLeft = '8px';
    cancelBtn.style.padding = '2px 8px';
    cancelBtn.style.background = '#f56565';
    cancelBtn.style.color = 'white';
    cancelBtn.style.border = 'none';
    cancelBtn.style.borderRadius = '4px';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.style.fontSize = '12px';
    
    messageActions.appendChild(cancelBtn);
    
    const countdown = setInterval(() => {
        secondsLeft--;
        cancelBtn.innerHTML = `Отмена (${secondsLeft})`;
        
        if (secondsLeft <= 0) {
            clearInterval(countdown);
            performDeletion(messageId, messageElement, deleteBtn, originalText, cancelBtn);
        }
    }, 1000);
    
    const cancelDeletion = () => {
        clearInterval(countdown);
        resetDeleteButton(deleteBtn, originalText);
        cancelBtn.remove();
    };
    
    cancelBtn.addEventListener('click', cancelDeletion);
    cancelBtn.__cancelHandler = cancelDeletion;
}

function resetDeleteButton(button, originalText) {
    button.disabled = false;
    button.innerHTML = originalText;
    button.style.opacity = '0.7';
    button.style.cursor = 'pointer';
}

function showReplyForm(messageId, recipientEmail) {
    document.querySelectorAll('.reply_form').forEach(form => {
        form.style.display = 'none';
    });
    
    const replyForm = document.getElementById(`replyForm-${messageId}`);
    const textarea = document.getElementById(`replyText-${messageId}`);
    
    if (replyForm) {
        replyForm.style.display = 'block';
        textarea.value = '';
        textarea.placeholder = `Ответ для ${recipientEmail}`;
        textarea.focus();
        replyForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function cancelReply(messageId) {
    const replyForm = document.getElementById(`replyForm-${messageId}`);
    const textarea = document.getElementById(`replyText-${messageId}`);
    
    if (replyForm) {
        textarea.value = '';
        replyForm.style.display = 'none';
    }
}

function submitReply(messageId) {
    const textarea = document.getElementById(`replyText-${messageId}`);
    if (!textarea) return;
    
    const replyText = textarea.value.trim();
    const submitBtn = document.querySelector(`#replyForm-${messageId} .reply_submit_btn`);
    
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Отправка...';
    
    fetch(`/reply_to_message/${messageId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
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

        }
    })
    .catch(error => {
        console.error('Error:', error);
    })
    .finally(() => {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Отправить';
    });
}

document.addEventListener('DOMContentLoaded', function() {
    // startMessageAutoUpdate();
    
    loadMessages();


    // window.addEventListener('beforeunload', function() {
    //     stopMessageAutoUpdate();
    // });
});