// function updateOnlineCount() {
//     fetch('/api/online-count')
//         .then(response => response.json())
//         .then(data => {
//             if (data.success) {
//                 const countElement = document.getElementById('onlineCount');
//                 if (countElement) {
//                     countElement.textContent = data.count;
//                 }
//             }
//         })
//         .catch(error => console.error('Error updating online count:', error));
// }

// setInterval(updateOnlineCount, 30000);
// document.addEventListener('DOMContentLoaded', updateOnlineCount);

const messageFlash = (function() {
    const containerId = 'flash-container';
    let container;
    let messages = []; 
    const DISPLAY_TIME = 30000; 

    function init() {
        container = document.getElementById(containerId);
        if (!container) {
            container = document.createElement('div');
            container.id = containerId;
            document.body.appendChild(container);
        }

        const storedMessages = JSON.parse(localStorage.getItem('flashMessages') || '[]');
        const now = Date.now();
        messages = storedMessages.filter(msg => now - msg.createdAt < DISPLAY_TIME);

        localStorage.setItem('flashMessages', JSON.stringify(messages));
        renderMessages();
    }

    function _showMessage(msgObj) {
        const alertBox = document.createElement('div');
        alertBox.className = `custom-alert ${msgObj.type === 'error' ? 'alert-danger' : 'alert-success'} collapsed`;

        const imgSrc = msgObj.type === 'error'
            ? '/static/img/svg/Error.svg'
            : '/static/img/svg/Checkmark.svg';

        alertBox.innerHTML = `
            <img src="${imgSrc}" class="alert-icon" alt="">
            <div class="p_message_cont">
                <p>${msgObj.msg}</p>
            </div>
            <button class="alert-close">&times;</button>
        `;

        alertBox.querySelector('.alert-close').addEventListener('click', e => {
            e.stopPropagation();
            removeMessage(alertBox, msgObj);
        });

        alertBox.addEventListener('click', () => {
            container.querySelectorAll('.custom-alert').forEach((el, index) => {
                if (index === container.children.length - 1) {
                    el.classList.toggle('expanded');
                    el.classList.toggle('collapsed');
                } else {
                    el.classList.remove('expanded');
                    el.classList.add('collapsed');
                }
            });
        });

        container.appendChild(alertBox);

        const now = Date.now();
        const elapsed = now - msgObj.createdAt;
        const remaining = Math.max(DISPLAY_TIME - elapsed, 0);

        if (remaining > 0) {
            setTimeout(() => {
                if (container.contains(alertBox)) {
                    removeMessage(alertBox, msgObj);
                }
            }, remaining);
        } else {
            removeMessage(alertBox, msgObj);
        }
    }

    function removeMessage(alertBox, msgObj) {
        alertBox.classList.add('removing');
        setTimeout(() => {
            if (container.contains(alertBox)) container.removeChild(alertBox);
            messages = messages.filter(m => m.msg !== msgObj.msg);
            localStorage.setItem('flashMessages', JSON.stringify(messages));
            renderMessages();
        }, 300);
    }

    function addMessage(msg, type='success') {
        const msgObj = { msg, type, createdAt: Date.now() };
        messages.push(msgObj);
        localStorage.setItem('flashMessages', JSON.stringify(messages));
        renderMessages();
    }

    function renderMessages() {
        container.innerHTML = '';
        messages.forEach(_showMessage);
        container.querySelectorAll('.custom-alert').forEach((el, index) => {
            if (index !== container.children.length - 1) {
                el.classList.add('collapsed');
            }
        });
    }

    return { init, addMessage };
})();

function addCsrfTokenToForm(form) {
    var csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
    if (!csrfToken) return;
    
    var csrfInput = form.querySelector('input[name="csrf_token"]');
    if (!csrfInput) {
        csrfInput = document.createElement('input');
        csrfInput.type = 'hidden';
        csrfInput.name = 'csrf_token';
        form.appendChild(csrfInput);
    }
    csrfInput.value = csrfToken;
}

function scrollToAdmin() {
    const formElement = document.getElementById('toadmin');
    if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth' });
    }
}

function updateHeaderButtonStyle(agreedActive, controlActive, sentActive, exportActive, ticketsActive) {
    const agreedVersionButton = document.getElementById('agreedVersionButton');
    const controlVersionButton = document.getElementById('control_versionButton');
    const sentVersionButton = document.getElementById('sentVersionButton');
    const exportVersionButton = document.getElementById('export_versionButton');
    const toTicketsBtn = document.getElementById('toTicketsBtn');
    
    if (agreedActive) {
        agreedVersionButton.style.opacity = '1';
        agreedVersionButton.style.cursor = 'pointer';
        agreedVersionButton.querySelector('img').style.filter = 'none';
        agreedVersionButton.querySelector('a').style.filter = 'none';
    } else {
        agreedVersionButton.style.opacity = '0.5';
        agreedVersionButton.style.cursor = 'not-allowed';
        agreedVersionButton.querySelector('img').style.filter = 'grayscale(100%)';
        agreedVersionButton.querySelector('a').style.filter = 'grayscale(100%)';
    }
    if (controlActive) {
        controlVersionButton.style.opacity = '1';
        controlVersionButton.style.cursor = 'pointer';
        controlVersionButton.querySelector('img').style.filter = 'none';
        controlVersionButton.querySelector('a').style.filter = 'none';
    } else {
        controlVersionButton.style.opacity = '0.5';
        controlVersionButton.style.cursor = 'not-allowed';
        controlVersionButton.querySelector('img').style.filter = 'grayscale(100%)';
        controlVersionButton.querySelector('a').style.filter = 'grayscale(100%)';
    }
    if (sentActive) {
        sentVersionButton.style.opacity = '1';
        sentVersionButton.style.cursor = 'pointer';
        sentVersionButton.querySelector('img').style.filter = 'none';
        sentVersionButton.querySelector('a').style.filter = 'none';
    } else {
        sentVersionButton.style.opacity = '0.5';
        sentVersionButton.style.cursor = 'not-allowed';
        sentVersionButton.querySelector('img').style.filter = 'grayscale(100%)';
        sentVersionButton.querySelector('a').style.filter = 'grayscale(100%)';
    }
    if (exportActive) {
        exportVersionButton.style.opacity = '1';
        exportVersionButton.style.cursor = 'pointer';
        exportVersionButton.querySelector('img').style.filter = 'none';
        exportVersionButton.querySelector('a').style.filter = 'none';
    } else {
        exportVersionButton.style.opacity = '0.5';
        exportVersionButton.style.cursor = 'not-allowed';
        exportVersionButton.querySelector('img').style.filter = 'grayscale(100%)';
        exportVersionButton.querySelector('a').style.filter = 'grayscale(100%)';
    }
    if (ticketsActive) {
        toTicketsBtn.style.opacity = '1';
        toTicketsBtn.style.cursor = 'pointer';
        toTicketsBtn.querySelector('img').style.filter = 'none';
        toTicketsBtn.querySelector('a').style.filter = 'none';
    } else {
        toTicketsBtn.style.opacity = '0.5';
        toTicketsBtn.style.cursor = 'not-allowed';
        toTicketsBtn.querySelector('img').style.filter = 'grayscale(100%)';
        toTicketsBtn.querySelector('a').style.filter = 'grayscale(100%)';
    }
}

window.addEventListener('scroll', () => {
    const header = document.querySelector('.fixed-header');
    const scrollY = window.scrollY;
    let ticking = false;
    if (!ticking) {
        requestAnimationFrame(() => {
            if (scrollY > 50) {
                if (!header.classList.contains('bubble')) {
                    header.classList.remove('bubble-reverse');
                    header.classList.add('bubble');
                }
            } else if (scrollY === 0) {
                if (header.classList.contains('bubble')) {
                    header.classList.remove('bubble');
                    header.classList.add('bubble-reverse');
                    setTimeout(() => {
                        header.classList.remove('bubble-reverse');
                    }, 500);
                }
            }
            
            ticking = false;
        });
        ticking = true;
    }
});

window.addEventListener('resize', () => {
    const header = document.querySelector('.fixed-header');
    const scrollY = window.scrollY;
    
    if (window.innerWidth <= 768) {
        if (scrollY > 50) {
            header.classList.add('bubble');
        } else if (scrollY === 0) {
            header.classList.remove('bubble');
        }
    }
});

window.addEventListener('resize', () => {
    if (window.scrollY > 0) {
        if (window.innerWidth < 1000) {
            header.style.boxShadow = 'none';
        }
    }
});

const clearButtons = document.querySelectorAll('.clear-btn');
clearButtons.forEach(btn => {
    btn.addEventListener('click', function() {
        const input = this.previousElementSibling;
        if (input && input.tagName === 'INPUT') {
            input.value = '';
        }
    });
});

function setupPasswordToggle(passwordFieldId, showIconClass, hideIconClass) {
    const passwordField = document.querySelector(`#${passwordFieldId}`);
    const showPasswordIcon = document.querySelector(`.${showIconClass}`); 
    const hidePasswordIcon = document.querySelector(`.${hideIconClass}`);
    
    if (passwordField && showPasswordIcon && hidePasswordIcon) {
        showPasswordIcon.style.display = 'none';
        hidePasswordIcon.style.display = 'none';

        function showIcons() {
            updateIconsVisibility();
            showPasswordIcon.style.visibility = 'visible';
            hidePasswordIcon.style.visibility = 'visible';
        }

        function hideIcons() {
            showPasswordIcon.style.visibility = 'hidden';
            hidePasswordIcon.style.visibility = 'hidden';
        }

        function updateIconsVisibility() {
            if (passwordField.type === 'password') {
                showPasswordIcon.style.display = 'inline';
                hidePasswordIcon.style.display = 'none';
            } else {
                showPasswordIcon.style.display = 'none';
                hidePasswordIcon.style.display = 'inline';
            }
        }

        passwordField.addEventListener('mouseover', showIcons);
        showPasswordIcon.addEventListener('mouseover', showIcons);
        hidePasswordIcon.addEventListener('mouseover', showIcons);

        passwordField.addEventListener('mouseout', hideIcons);
        showPasswordIcon.addEventListener('mouseout', hideIcons);
        hidePasswordIcon.addEventListener('mouseout', hideIcons);

        showPasswordIcon.addEventListener('click', function() {
            passwordField.type = 'text';
            updateIconsVisibility();
        });

        hidePasswordIcon.addEventListener('click', function() {
            passwordField.type = 'password';
            updateIconsVisibility();
        });
    }
}

function filterSentedReports() {
    var year = document.getElementById('selected-year-audit').value;
    var quarter = document.getElementById('selected-quarter-audit').value;
    var status = document.getElementById('status-audit').value;
    var infoSelector = document.getElementById('selector-info-audit');
    
    if (!quarter) {
        infoSelector.textContent = "Пожалуйста, выберите квартал";
        infoSelector.style.color = "#ef4444";
        infoSelector.style.fontSize = "14px";
        infoSelector.style.marginTop = "5px";
        
        var quarterGrid = document.getElementById('quarter-grid-not-full');
        if (quarterGrid) {
            quarterGrid.classList.add('pulse-animation');
            setTimeout(function() {
                quarterGrid.classList.remove('pulse-animation');
            }, 1500);
        }

        return;
    }

    var url = `/audit-area/${status}?year=${year}&quarter=${quarter}`;
    window.location.href = url;
}

/* message-animation */
// (function() {
//     var alertBox = document.querySelector('.custom-alert');
//     if (alertBox) {
//         var progressBar = alertBox.querySelector('.notif-progress');
//         if (progressBar) {
//             progressBar.style.animation = 'runProgress-mes 7.7s linear forwards';
//         }
//         setTimeout(function() {
//             alertBox.classList.add('show');
//         }, 100); 

//         setTimeout(function() {
//             alertBox.classList.remove('show');
//             alertBox.classList.add('hidden');
//         }, 7700); 
//     }
// })();
/* end message-animation */

/* only numbers */
var numericInputs = document.querySelectorAll('.numericInput');
numericInputs.forEach(function(input) {
    input.addEventListener('input', function(event) {
        this.value = this.value.replace(/\D/g, '');
    });
});
/* end only numbers */

/* numbers + dot only */
var numeric_dotInputs = document.querySelectorAll('.numeric_dotInput');
numeric_dotInputs.forEach(function(input) {
    input.addEventListener('input', function(event) {
        var oldValue = this.value;
        var selectionStart = this.selectionStart;
        var selectionEnd = this.selectionEnd;
        var processedValue = oldValue.replace(/,/g, '.'); 
        var value = processedValue.replace(/[^\d.]/g, '');
        var parts = value.split('.');
        if (parts.length > 1) {
            value = parts[0] + '.' + parts[1].slice(0, 2);
        }
        
        if (value.startsWith('0') && value.length > 1 && value[1] !== '.') {
            value = value.substring(1);
        }

        if (!value.includes('.')) {
            value += '.00';
        }
        
        value = value.replace('.', ',');

        var oldCommaIndex = oldValue.indexOf(',');
        var newCommaIndex = value.indexOf(',');

        this.value = value;

        if (selectionEnd - selectionStart > 1) {
            this.setSelectionRange(selectionEnd, selectionEnd);
        } else if (selectionStart <= oldCommaIndex) {
            var cursorPos = selectionStart + (newCommaIndex - oldCommaIndex);
            this.setSelectionRange(cursorPos, cursorPos);
        } else {
            this.setSelectionRange(selectionStart, selectionStart);
        }
    });

    input.addEventListener('focus', function(event) {
        if (this.value === '') {
            this.value = '0,00';
        }

        var commaIndex = this.value.indexOf(',');
        if (commaIndex !== -1) {
            this.setSelectionRange(commaIndex, commaIndex);
        }
    });

    input.addEventListener('click', function(event) {
        this.select();
    });
});
/* end numbers + dot only */


/* SORT AND RESIZE TABLE */
function initResizableTables() {
    const tables = document.querySelectorAll('.table-report-area');
    tables.forEach(table => {
        const thElements = table.querySelectorAll('th.resizable');
        let isResizing = false;
        let startX = 0;
        let startWidth = 0;
        let currentTh = null;

        thElements.forEach(th => {
            const resizer = th.querySelector('.resizer');
            if (resizer) {
                resizer.addEventListener('mousedown', function(e) {
                    isResizing = true;
                    startX = e.clientX;
                    startWidth = th.offsetWidth;
                    currentTh = th;
                    document.body.style.cursor = 'col-resize';
                    e.preventDefault();
                });
            }
        });

        table.addEventListener('mousemove', function(e) {
            if (isResizing) {
                const newWidth = startWidth + (e.clientX - startX);
                currentTh.style.width = newWidth + 'px';
                currentTh.style.minWidth = newWidth + 'px';
            }
        });

        table.addEventListener('mouseup', function() {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
            }
        });

        table.addEventListener('mouseleave', function() {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
            }
        });
    });
}

function initTableSorting() {
    const table = document.getElementById('report-table');
    if (!table) return;

    const headers = table.querySelectorAll('th.resizable[data-sort-col]');
    
    headers.forEach(th => {
        const sortLabel = th.querySelector('.sort-label');
        if (!sortLabel) return;
        
        sortLabel.style.cursor = 'pointer';
        
        sortLabel.addEventListener('click', (e) => {
            if (e.target.classList && e.target.classList.contains('resizer')) return;
            if (e.target.closest('.resizer')) return;
            
            const sortCol = th.getAttribute('data-sort-col');
            if (!sortCol) return;

            let currentDirection = th.getAttribute('data-sort-direction');
            let newDirection;
            
            const allThs = table.querySelectorAll('th.resizable');
            allThs.forEach(t => {
                t.removeAttribute('data-sort-direction');
                t.classList.remove('sort-active');
            });
            
            if (!currentDirection || currentDirection === 'desc') {
                newDirection = 'asc';
            } else {
                newDirection = 'desc';
            }
            
            th.setAttribute('data-sort-direction', newDirection);
            th.classList.add('sort-active');
            
            sortTable(table, sortCol, newDirection);
        });
    });
}

function initSecondTableSorting() {
    const table = document.getElementById('fuel-table-report');
    if (!table) return;

    const headers = table.querySelectorAll('th.resizable[data-sort-col]');
    
    headers.forEach(th => {
        const sortLabel = th.querySelector('.sort-label');
        if (!sortLabel) return;
        
        sortLabel.style.cursor = 'pointer';
        
        sortLabel.addEventListener('click', (e) => {
            if (e.target.classList && e.target.classList.contains('resizer')) return;
            if (e.target.closest('.resizer')) return;
            
            const sortCol = th.getAttribute('data-sort-col');
            if (!sortCol) return;

            let currentDirection = th.getAttribute('data-sort-direction');
            let newDirection;
            
            const allThs = table.querySelectorAll('th.resizable');
            allThs.forEach(t => {
                t.removeAttribute('data-sort-direction');
                t.classList.remove('sort-active');
            });
            
            if (!currentDirection || currentDirection === 'desc') {
                newDirection = 'asc';
            } else {
                newDirection = 'desc';
            }
            
            th.setAttribute('data-sort-direction', newDirection);
            th.classList.add('sort-active');
            
            sortSecondTable(table, sortCol, newDirection);
        });
    });
}

function sortTable(table, column, direction) {
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr.report_row'));
    
    let columnIndex;
    
    switch(column) {
        case 'name':
            columnIndex = 3;
            break;
        case 'okpo':
            columnIndex = 4;
            break;
        case 'region':
            columnIndex = 5;
            break;
        case 'year':
            columnIndex = 6;
            break;
        case 'quarter':
            columnIndex = 7;
            break;
        case 'time':
            columnIndex = 8;
            break;
        case 'status':
            columnIndex = 9;
            break;
        default:
            columnIndex = -1;
    }
    
    if (columnIndex === -1) return;
    
    const statusOrder = {
        'Заполнение': 1,
        'Контроль пройден': 2,
        'Согласовано': 3,
        'На рассмотрении': 4,
        'Есть замечания': 5,
        'Одобрен': 6,
        'Готов к удалению': 7
    };
    
    const sortedRows = rows.sort((rowA, rowB) => {
        const cellA = rowA.children[columnIndex];
        const cellB = rowB.children[columnIndex];
        
        let valueA, valueB;
        
        if (column === 'name') {
            valueA = cellA.querySelector('input')?.value.trim().toLowerCase() || cellA.textContent.trim().toLowerCase();
            valueB = cellB.querySelector('input')?.value.trim().toLowerCase() || cellB.textContent.trim().toLowerCase();
        } else if (column === 'region') {
            valueA = cellA.querySelector('input')?.value.trim().toLowerCase() || cellA.textContent.trim().toLowerCase();
            valueB = cellB.querySelector('input')?.value.trim().toLowerCase() || cellB.textContent.trim().toLowerCase();
        } else if (column === 'okpo') {
            valueA = cellA.querySelector('input')?.value.trim() || cellA.textContent.trim();
            valueB = cellB.querySelector('input')?.value.trim() || cellB.textContent.trim();
        } else if (column === 'quarter') {
            const rawA = cellA.querySelector('input')?.value || cellA.textContent.trim();
            const rawB = cellB.querySelector('input')?.value || cellB.textContent.trim();
            valueA = parseInt(rawA, 10);
            valueB = parseInt(rawB, 10);
        } else if (column === 'year') {
            const rawA = cellA.querySelector('input')?.value || cellA.textContent.trim();
            const rawB = cellB.querySelector('input')?.value || cellB.textContent.trim();
            valueA = parseInt(rawA, 10);
            valueB = parseInt(rawB, 10);
        } else if (column === 'time') {
            const rawA = cellA.querySelector('input')?.value || cellA.textContent.trim();
            const rawB = cellB.querySelector('input')?.value || cellB.textContent.trim();
            const parseDate = (str) => {
                const parts = str.split('-');
                return new Date(parts[2], parts[1] - 1, parts[0]);
            };
            valueA = parseDate(rawA);
            valueB = parseDate(rawB);
        } else if (column === 'status') {
            const textA = cellA.textContent.trim();
            const textB = cellB.textContent.trim();
            valueA = statusOrder[textA] || 999;
            valueB = statusOrder[textB] || 999;
        }
        
        if (typeof valueA === 'number' && typeof valueB === 'number') {
            return direction === 'asc' ? valueA - valueB : valueB - valueA;
        }
        
        if (valueA < valueB) return direction === 'asc' ? -1 : 1;
        if (valueA > valueB) return direction === 'asc' ? 1 : -1;
        return 0;
    });
    
    sortedRows.forEach(row => tbody.appendChild(row));
}

function sortSecondTable(table, column, direction) {
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr.section_row'));
    
    let columnIndex;
    
    switch(column) {
        case 'name':  
            columnIndex = 1;
            break;
        case 'code': 
            columnIndex = 2;
            break;
        case 'oked':    
            columnIndex = 3;
            break;
        case 'ed-izm': 
            columnIndex = 4;
            break;
        case 'section-1': 
            columnIndex = 5;
            break;
        case 'section-2': 
            columnIndex = 6;
            break;
        case 'section-3': 
            columnIndex = 7;
            break;
        case 'section-4': 
            columnIndex = 8;
            break;
        case 'section-5': 
            columnIndex = 9;
            break;
        case 'section-6': 
            columnIndex = 10;
            break;
        case 'note': 
            columnIndex = 11;
            break;
        default:
            columnIndex = -1;
    }
    
    if (columnIndex === -1) return;
    
    const specialCodes = ['9001', '9010', '9100'];
    
    const normalRows = [];
    const specialRows = [];
    
    rows.forEach(row => {
        const codeCell = row.children[2];
        const codeValue = codeCell.querySelector('input')?.value.trim() || codeCell.textContent.trim();
        
        if (specialCodes.includes(codeValue)) {
            specialRows.push(row);
        } else {
            normalRows.push(row);
        }
    });
    
    const sortedNormalRows = normalRows.sort((rowA, rowB) => {
        const cellA = rowA.children[columnIndex];
        const cellB = rowB.children[columnIndex];
        
        let valueA, valueB;
        
        if (column === 'name') {
            valueA = cellA.querySelector('input')?.value.trim().toLowerCase() || cellA.textContent.trim().toLowerCase();
            valueB = cellB.querySelector('input')?.value.trim().toLowerCase() || cellB.textContent.trim().toLowerCase();
        } 
        else if (column === 'code') {
            const rawA = cellA.querySelector('input')?.value || cellA.textContent.trim();
            const rawB = cellB.querySelector('input')?.value || cellB.textContent.trim();
            valueA = parseInt(rawA, 10) || 0;
            valueB = parseInt(rawB, 10) || 0;
        } 
        else if (column === 'oked') {
            const rawA = cellA.querySelector('input')?.value || cellA.textContent.trim();
            const rawB = cellB.querySelector('input')?.value || cellB.textContent.trim();
            valueA = parseInt(rawA, 10) || 0;
            valueB = parseInt(rawB, 10) || 0;
        } 
        else if (column === 'ed-izm') {
            valueA = cellA.querySelector('input')?.value.trim().toLowerCase() || cellA.textContent.trim().toLowerCase();
            valueB = cellB.querySelector('input')?.value.trim().toLowerCase() || cellB.textContent.trim().toLowerCase();
        } 
        else if (column === 'note') {
            valueA = cellA.querySelector('input')?.value.trim().toLowerCase() || cellA.textContent.trim().toLowerCase();
            valueB = cellB.querySelector('input')?.value.trim().toLowerCase() || cellB.textContent.trim().toLowerCase();
        } 
        else {
            const rawA = cellA.querySelector('input')?.value || cellA.textContent.trim();
            const rawB = cellB.querySelector('input')?.value || cellB.textContent.trim();
            
            const cleanA = rawA ? rawA.toString().replace(',', '.') : '0';
            const cleanB = rawB ? rawB.toString().replace(',', '.') : '0';
            
            valueA = parseFloat(cleanA) || 0;
            valueB = parseFloat(cleanB) || 0;
        }
        
        if (typeof valueA === 'number' && typeof valueB === 'number') {
            return direction === 'asc' ? valueA - valueB : valueB - valueA;
        }
        
        if (valueA < valueB) return direction === 'asc' ? -1 : 1;
        if (valueA > valueB) return direction === 'asc' ? 1 : -1;
        return 0;
    });
    
    const allSortedRows = [...sortedNormalRows, ...specialRows];
    allSortedRows.forEach(row => tbody.appendChild(row));
}



function sortFuelTable(table, column, direction) {
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr.section_row'));
    
    let columnIndex;
    
    switch(column) {
        case 'name':  
            columnIndex = 1;
            break;
        case 'code': 
            columnIndex = 2;
            break;
        case 'oked':    
            columnIndex = 3;
            break;
        case 'ed-izm': 
            columnIndex = 4;
            break;
        case 'section-1': 
            columnIndex = 5;
            break;
        case 'section-2': 
            columnIndex = 6;
            break;
        case 'section-3': 
            columnIndex = 7;
            break;
        case 'section-4': 
            columnIndex = 8;
            break;
        case 'section-5': 
            columnIndex = 9;
            break;
        case 'section-6': 
            columnIndex = 10;
            break;
        case 'note': 
            columnIndex = 11;
            break;
        default:
            columnIndex = -1;
    }
    
    if (columnIndex === -1) return;
    
    // Специальные коды, которые должны быть внизу
    const specialCodes = ['9001', '9010', '9100'];
    
    const normalRows = [];
    const specialRows = [];
    
    rows.forEach(row => {
        const codeCell = row.children[2];
        const codeValue = codeCell.querySelector('input')?.value.trim() || codeCell.textContent.trim();
        
        if (specialCodes.includes(codeValue)) {
            specialRows.push(row);
        } else {
            normalRows.push(row);
        }
    });
    
    const sortedNormalRows = normalRows.sort((rowA, rowB) => {
        const cellA = rowA.children[columnIndex];
        const cellB = rowB.children[columnIndex];
        
        let valueA, valueB;
        
        if (column === 'name') {
            valueA = cellA.querySelector('input')?.value.trim().toLowerCase() || cellA.textContent.trim().toLowerCase();
            valueB = cellB.querySelector('input')?.value.trim().toLowerCase() || cellB.textContent.trim().toLowerCase();
        } 
        else if (column === 'code') {
            const rawA = cellA.querySelector('input')?.value || cellA.textContent.trim();
            const rawB = cellB.querySelector('input')?.value || cellB.textContent.trim();
            valueA = parseInt(rawA, 10) || 0;
            valueB = parseInt(rawB, 10) || 0;
        } 
        else if (column === 'oked') {
            const rawA = cellA.querySelector('input')?.value || cellA.textContent.trim();
            const rawB = cellB.querySelector('input')?.value || cellB.textContent.trim();
            valueA = parseInt(rawA, 10) || 0;
            valueB = parseInt(rawB, 10) || 0;
        } 
        else if (column === 'ed-izm') {
            valueA = cellA.querySelector('input')?.value.trim().toLowerCase() || cellA.textContent.trim().toLowerCase();
            valueB = cellB.querySelector('input')?.value.trim().toLowerCase() || cellB.textContent.trim().toLowerCase();
        } 
        else if (column === 'note') {
            valueA = cellA.querySelector('input')?.value.trim().toLowerCase() || cellA.textContent.trim().toLowerCase();
            valueB = cellB.querySelector('input')?.value.trim().toLowerCase() || cellB.textContent.trim().toLowerCase();
        } 
        else {
            const rawA = cellA.querySelector('input')?.value || cellA.textContent.trim();
            const rawB = cellB.querySelector('input')?.value || cellB.textContent.trim();
            const cleanA = rawA ? rawA.toString().replace(',', '.') : '0';
            const cleanB = rawB ? rawB.toString().replace(',', '.') : '0';
            valueA = parseFloat(cleanA) || 0;
            valueB = parseFloat(cleanB) || 0;
        }
        
        if (typeof valueA === 'number' && typeof valueB === 'number') {
            return direction === 'asc' ? valueA - valueB : valueB - valueA;
        }
        
        if (valueA < valueB) return direction === 'asc' ? -1 : 1;
        if (valueA > valueB) return direction === 'asc' ? 1 : -1;
        return 0;
    });
    
    const allSortedRows = [...sortedNormalRows, ...specialRows];
    allSortedRows.forEach(row => tbody.appendChild(row));
}


function sortHeatTable(table, column, direction) {
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr.section_row'));
    
    let columnIndex;
    
    switch(column) {
        case 'name':  
            columnIndex = 1;
            break;
        case 'code': 
            columnIndex = 2;
            break;
        case 'oked':    
            columnIndex = 3;
            break;
        case 'ed-izm': 
            columnIndex = 4;
            break;
        case 'section-1': 
            columnIndex = 5;
            break;
        case 'section-2': 
            columnIndex = 6;
            break;
        case 'section-3': 
            columnIndex = 7;
            break;
        case 'section-4': 
            columnIndex = 8;
            break;
        case 'section-5': 
            columnIndex = 9;
            break;
        case 'section-6': 
            columnIndex = 10;
            break;
        case 'note': 
            columnIndex = 11;
            break;
        default:
            columnIndex = -1;
    }
    
    if (columnIndex === -1) return;
    
    const specialCodes = ['9001', '9010', '9100'];
    const normalRows = [];
    const specialRows = [];
    
    rows.forEach(row => {
        const codeCell = row.children[2];
        const codeValue = codeCell.querySelector('input')?.value.trim() || codeCell.textContent.trim();
        
        if (specialCodes.includes(codeValue)) {
            specialRows.push(row);
        } else {
            normalRows.push(row);
        }
    });
    
    const sortedNormalRows = normalRows.sort((rowA, rowB) => {
        const cellA = rowA.children[columnIndex];
        const cellB = rowB.children[columnIndex];
        
        let valueA, valueB;
        
        if (column === 'name') {
            valueA = cellA.querySelector('input')?.value.trim().toLowerCase() || cellA.textContent.trim().toLowerCase();
            valueB = cellB.querySelector('input')?.value.trim().toLowerCase() || cellB.textContent.trim().toLowerCase();
        } 
        else if (column === 'code') {
            const rawA = cellA.querySelector('input')?.value || cellA.textContent.trim();
            const rawB = cellB.querySelector('input')?.value || cellB.textContent.trim();
            valueA = parseInt(rawA, 10) || 0;
            valueB = parseInt(rawB, 10) || 0;
        } 
        else if (column === 'oked') {
            const rawA = cellA.querySelector('input')?.value || cellA.textContent.trim();
            const rawB = cellB.querySelector('input')?.value || cellB.textContent.trim();
            valueA = parseInt(rawA, 10) || 0;
            valueB = parseInt(rawB, 10) || 0;
        } 
        else if (column === 'ed-izm') {
            valueA = cellA.querySelector('input')?.value.trim().toLowerCase() || cellA.textContent.trim().toLowerCase();
            valueB = cellB.querySelector('input')?.value.trim().toLowerCase() || cellB.textContent.trim().toLowerCase();
        } 
        else if (column === 'note') {
            valueA = cellA.querySelector('input')?.value.trim().toLowerCase() || cellA.textContent.trim().toLowerCase();
            valueB = cellB.querySelector('input')?.value.trim().toLowerCase() || cellB.textContent.trim().toLowerCase();
        } 
        else {
            const rawA = cellA.querySelector('input')?.value || cellA.textContent.trim();
            const rawB = cellB.querySelector('input')?.value || cellB.textContent.trim();
            const cleanA = rawA ? rawA.toString().replace(',', '.') : '0';
            const cleanB = rawB ? rawB.toString().replace(',', '.') : '0';
            valueA = parseFloat(cleanA) || 0;
            valueB = parseFloat(cleanB) || 0;
        }
        
        if (typeof valueA === 'number' && typeof valueB === 'number') {
            return direction === 'asc' ? valueA - valueB : valueB - valueA;
        }
        
        if (valueA < valueB) return direction === 'asc' ? -1 : 1;
        if (valueA > valueB) return direction === 'asc' ? 1 : -1;
        return 0;
    });
    
    const allSortedRows = [...sortedNormalRows, ...specialRows];
    allSortedRows.forEach(row => tbody.appendChild(row));
}


function sortElectroTable(table, column, direction) {
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr.section_row'));
    
    let columnIndex;
    
    switch(column) {
        case 'name':  
            columnIndex = 1;
            break;
        case 'code': 
            columnIndex = 2;
            break;
        case 'oked':    
            columnIndex = 3;
            break;
        case 'ed-izm': 
            columnIndex = 4;
            break;
        case 'section-1': 
            columnIndex = 5;
            break;
        case 'section-2': 
            columnIndex = 6;
            break;
        case 'section-3': 
            columnIndex = 7;
            break;
        case 'section-4': 
            columnIndex = 8;
            break;
        case 'section-5': 
            columnIndex = 9;
            break;
        case 'section-6': 
            columnIndex = 10;
            break;
        case 'note': 
            columnIndex = 11;
            break;
        default:
            columnIndex = -1;
    }
    
    if (columnIndex === -1) return;
    
    const specialCodes = ['9001', '9010', '9100'];
    const normalRows = [];
    const specialRows = [];
    
    rows.forEach(row => {
        const codeCell = row.children[2];
        const codeValue = codeCell.querySelector('input')?.value.trim() || codeCell.textContent.trim();
        
        if (specialCodes.includes(codeValue)) {
            specialRows.push(row);
        } else {
            normalRows.push(row);
        }
    });
    
    const sortedNormalRows = normalRows.sort((rowA, rowB) => {
        const cellA = rowA.children[columnIndex];
        const cellB = rowB.children[columnIndex];
        
        let valueA, valueB;
        
        if (column === 'name') {
            valueA = cellA.querySelector('input')?.value.trim().toLowerCase() || cellA.textContent.trim().toLowerCase();
            valueB = cellB.querySelector('input')?.value.trim().toLowerCase() || cellB.textContent.trim().toLowerCase();
        } 
        else if (column === 'code') {
            const rawA = cellA.querySelector('input')?.value || cellA.textContent.trim();
            const rawB = cellB.querySelector('input')?.value || cellB.textContent.trim();
            valueA = parseInt(rawA, 10) || 0;
            valueB = parseInt(rawB, 10) || 0;
        } 
        else if (column === 'oked') {
            const rawA = cellA.querySelector('input')?.value || cellA.textContent.trim();
            const rawB = cellB.querySelector('input')?.value || cellB.textContent.trim();
            valueA = parseInt(rawA, 10) || 0;
            valueB = parseInt(rawB, 10) || 0;
        } 
        else if (column === 'ed-izm') {
            valueA = cellA.querySelector('input')?.value.trim().toLowerCase() || cellA.textContent.trim().toLowerCase();
            valueB = cellB.querySelector('input')?.value.trim().toLowerCase() || cellB.textContent.trim().toLowerCase();
        } 
        else if (column === 'note') {
            valueA = cellA.querySelector('input')?.value.trim().toLowerCase() || cellA.textContent.trim().toLowerCase();
            valueB = cellB.querySelector('input')?.value.trim().toLowerCase() || cellB.textContent.trim().toLowerCase();
        } 
        else {
            const rawA = cellA.querySelector('input')?.value || cellA.textContent.trim();
            const rawB = cellB.querySelector('input')?.value || cellB.textContent.trim();
            const cleanA = rawA ? rawA.toString().replace(',', '.') : '0';
            const cleanB = rawB ? rawB.toString().replace(',', '.') : '0';
            valueA = parseFloat(cleanA) || 0;
            valueB = parseFloat(cleanB) || 0;
        }
        
        if (typeof valueA === 'number' && typeof valueB === 'number') {
            return direction === 'asc' ? valueA - valueB : valueB - valueA;
        }
        
        if (valueA < valueB) return direction === 'asc' ? -1 : 1;
        if (valueA > valueB) return direction === 'asc' ? 1 : -1;
        return 0;
    });
    
    const allSortedRows = [...sortedNormalRows, ...specialRows];
    allSortedRows.forEach(row => tbody.appendChild(row));
}

function initTableSortingAudit() {
    // Топливная таблица
    const fuelTable = document.querySelector('#fuel_section_table .table-report-area');
    if (fuelTable) {
        const headers = fuelTable.querySelectorAll('th.resizable[data-sort-col]');
        headers.forEach(th => {
            const sortLabel = th.querySelector('.sort-label');
            if (!sortLabel) return;
            
            sortLabel.style.cursor = 'pointer';
            
            sortLabel.addEventListener('click', (e) => {
                if (e.target.classList && e.target.classList.contains('resizer')) return;
                if (e.target.closest('.resizer')) return;
                
                const sortCol = th.getAttribute('data-sort-col');
                if (!sortCol) return;
                
                let currentDirection = th.getAttribute('data-sort-direction');
                let newDirection;
                
                const allThs = fuelTable.querySelectorAll('th.resizable');
                allThs.forEach(t => {
                    t.removeAttribute('data-sort-direction');
                    t.classList.remove('sort-active');
                });
                
                if (!currentDirection || currentDirection === 'desc') {
                    newDirection = 'asc';
                } else {
                    newDirection = 'desc';
                }
                
                th.setAttribute('data-sort-direction', newDirection);
                th.classList.add('sort-active');
                
                sortFuelTable(fuelTable, sortCol, newDirection);
            });
        });
    }
    
    // Тепловая таблица
    const heatTable = document.querySelector('#heat_section_table .table-report-area');
    if (heatTable) {
        const headers = heatTable.querySelectorAll('th.resizable[data-sort-col]');
        headers.forEach(th => {
            const sortLabel = th.querySelector('.sort-label');
            if (!sortLabel) return;
            
            sortLabel.style.cursor = 'pointer';
            
            sortLabel.addEventListener('click', (e) => {
                if (e.target.classList && e.target.classList.contains('resizer')) return;
                if (e.target.closest('.resizer')) return;
                
                const sortCol = th.getAttribute('data-sort-col');
                if (!sortCol) return;
                
                let currentDirection = th.getAttribute('data-sort-direction');
                let newDirection;
                
                const allThs = heatTable.querySelectorAll('th.resizable');
                allThs.forEach(t => {
                    t.removeAttribute('data-sort-direction');
                    t.classList.remove('sort-active');
                });
                
                if (!currentDirection || currentDirection === 'desc') {
                    newDirection = 'asc';
                } else {
                    newDirection = 'desc';
                }
                
                th.setAttribute('data-sort-direction', newDirection);
                th.classList.add('sort-active');
                
                sortHeatTable(heatTable, sortCol, newDirection);
            });
        });
    }
    
    // Электро таблица
    const electroTable = document.querySelector('#electro_section_table .table-report-area');
    if (electroTable) {
        const headers = electroTable.querySelectorAll('th.resizable[data-sort-col]');
        headers.forEach(th => {
            const sortLabel = th.querySelector('.sort-label');
            if (!sortLabel) return;
            
            sortLabel.style.cursor = 'pointer';
            
            sortLabel.addEventListener('click', (e) => {
                if (e.target.classList && e.target.classList.contains('resizer')) return;
                if (e.target.closest('.resizer')) return;
                
                const sortCol = th.getAttribute('data-sort-col');
                if (!sortCol) return;
                
                let currentDirection = th.getAttribute('data-sort-direction');
                let newDirection;
                
                const allThs = electroTable.querySelectorAll('th.resizable');
                allThs.forEach(t => {
                    t.removeAttribute('data-sort-direction');
                    t.classList.remove('sort-active');
                });
                
                if (!currentDirection || currentDirection === 'desc') {
                    newDirection = 'asc';
                } else {
                    newDirection = 'desc';
                }
                
                th.setAttribute('data-sort-direction', newDirection);
                th.classList.add('sort-active');
                
                sortElectroTable(electroTable, sortCol, newDirection);
            });
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initTableSortingAudit();
});

document.addEventListener('DOMContentLoaded', () => {
    if(document.querySelector('.table-report-area')){
        initResizableTables();
        initTableSorting();
        initSecondTableSorting();
    }
});
/* SORT AND RESIZE TABLE END*/





document.addEventListener('DOMContentLoaded', function () {
    const usernavigation = document.getElementById('user-navigation');
    const overlay = document.querySelector('.overlay');

    setupPasswordToggle('password-field', 'show-icon', 'hide-icon');
    setupPasswordToggle('password-field1', 'show-icon1', 'hide-icon1');

    const userImgs = document.querySelectorAll('.user-container');
    let timeoutId;
    
    function showusernavigation() {
        if (usernavigation && overlay) {
            usernavigation.classList.remove('hidden');
            usernavigation.classList.add('show');
            overlay.classList.add('show');
        }
    }
    
    function hideusernavigation() {
        if (usernavigation && overlay) {
            usernavigation.classList.remove('show');
            usernavigation.classList.add('hidden');
            overlay.classList.remove('show');
        }
    }
    
    function setupEventListeners(element) {
        element.addEventListener('click', function(event) {
            clearTimeout(timeoutId);
            showusernavigation();
            event.stopPropagation();
        });
    }
    
    if (usernavigation && overlay) {
        document.addEventListener('click', function(event) {
            if (!usernavigation.contains(event.target)) {
                hideusernavigation();
            }
        });
    
        usernavigation.addEventListener('click', function(event) {
            event.stopPropagation();
        });
    }
    

    userImgs.forEach(setupEventListeners);
    document.addEventListener('click', function(event) {
        if (!usernavigation.contains(event.target)) {
            hideusernavigation();
        }
    });
    
    usernavigation.addEventListener('click', function(event) {
        event.stopPropagation();
    });
    /* end hoveruser panel */

    /* ============= report_area =============*/
    var reportRows = document.querySelectorAll('.report_row');
    var previousReportRow = null;
    var contextMenuReport = document.getElementById('contextMenu_report');
    var longPressTimer = null;
    var LONG_PRESS_DELAY = 500;
    var isLongPress = false;

    function showContextMenu(event, row) {
        event.preventDefault();
        
        if (row.dataset.id) {
            selectedReportId = row.dataset.id;
            
            if (previousReportRow !== null) {
                previousReportRow.classList.remove('active-report');
            }
            row.classList.add('active-report');
            
            updateHeaderButtonStyle(true, true, true, true, true);
            previousReportRow = row;

            var pageX, pageY;
            
            if (event.touches) {
                pageX = event.touches[0].pageX;
                pageY = event.touches[0].pageY;
            } else {
                pageX = event.pageX;
                pageY = event.pageY;
            }
            
            contextMenuReport.style.top = pageY + 'px';
            contextMenuReport.style.left = pageX + 'px';
            contextMenuReport.style.display = 'flex';
        }
    }

    reportRows.forEach(function(row) {
        row.addEventListener('click', function(event) {
            if (isLongPress) {
                isLongPress = false;
                return;
            }
            
            activeRow = null;
            updateHeaderButtonStyle(true, true, true, true, true);
            if (this.dataset.id) {
                selectedReportId = this.dataset.id;
                if (this.classList.contains('active-report')) {
                    this.classList.remove('active-report');
                    previousReportRow = null;
                    updateHeaderButtonStyle(false, false, false, false, false);
                } else {
                    if (previousReportRow !== null) {
                        previousReportRow.classList.remove('active-report');
                    }
                    this.classList.add('active-report');
                    previousReportRow = this;
                }
            }
        });
        
        row.addEventListener('contextmenu', function(event) {
            event.preventDefault();
            showContextMenu(event, this);
        });
        
        row.addEventListener('touchstart', function(event) {
            isLongPress = false;
            longPressTimer = setTimeout(() => {
                isLongPress = true;
                showContextMenu(event, this);
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
            }, LONG_PRESS_DELAY);
        });
        
        row.addEventListener('touchmove', function(event) {
            clearTimeout(longPressTimer);
        });
        
        row.addEventListener('touchend', function(event) {
            clearTimeout(longPressTimer);
        });
        
        row.addEventListener('touchcancel', function(event) {
            clearTimeout(longPressTimer);
        });
    });

    document.addEventListener('click', function(event) {
        if (!contextMenuReport.contains(event.target)) {
            contextMenuReport.style.display = 'none';
        }
    });

    document.addEventListener('touchstart', function(event) {
        if (!contextMenuReport.contains(event.target)) {
            contextMenuReport.style.display = 'none';
        }
    });
    /*end*/

    if(document.getElementById('add_report_modal')){
        handleModal(document.getElementById('add_report_modal'), document.getElementById('link_add_report'));
    }
    if(document.getElementById('SentModal')){
        handleModal(document.getElementById('SentModal'), document.getElementById('sentVersionButton'));
    }
    if(document.getElementById('change_period_report_modal')){
        handleModal(document.getElementById('change_period_report_modal'), document.getElementById('link_change_report'));
        link_change_report = document.getElementById('link_change_report')
        link_change_report.addEventListener('click', function(event) {
            event.preventDefault();
            var reportRow = document.querySelector('.report_row.active-report');
            if (reportRow) {
                var reportId = reportRow.querySelector('#report_id').value;
                var reportYear = reportRow.querySelector('#report_year').value;
                var reportQuarter = reportRow.querySelector('#report_quarter').value;

                document.getElementById('modal_change_report_id').value = reportId;
                document.getElementById('selected-year-change').value = reportYear;
                document.getElementById('selected-quarter-change').value = reportQuarter;

                if (window.periodSelectors && window.periodSelectors.change) {
                    window.periodSelectors.change.setYear(parseInt(reportYear));
                    if (reportQuarter) {
                        window.periodSelectors.change.setQuarter(reportQuarter);
                    }
                }
            }
            change_period_report_modal.classList.add('active');
            contextMenuReport.style.display = 'none';
        });

    }
    
    if(document.getElementById('copy_report_modal')){
        handleModal(document.getElementById('copy_report_modal'), document.getElementById('link_coppy_report'));
            link_coppy_report.addEventListener('click', function(event) {
            event.preventDefault();
            var reportRow = document.querySelector('.report_row.active-report');
            if (reportRow) {
                var reportId = reportRow.querySelector('#report_id').value;
                var reportYear = reportRow.querySelector('#report_year').value;
                var reportQuarter = reportRow.querySelector('#report_quarter').value;

                document.getElementById('modal_copy_report_id').value = reportId;
                document.getElementById('selected-year-copy').value = reportYear;
                document.getElementById('selected-quarter-copy').value = reportQuarter;

                if (window.periodSelectors && window.periodSelectors.copy) {
                    window.periodSelectors.copy.setYear(parseInt(reportYear));
                    if (reportQuarter) {
                        window.periodSelectors.copy.setQuarter(reportQuarter);
                    }
                }
            }
            copy_report_modal.classList.add('active');
            contextMenuReport.style.display = 'none';
        });
    }


    if(document.getElementById('del_reportButton')){
        const del_reportButton = document.getElementById('del_reportButton');
        del_reportButton.addEventListener('click', function(event) {
            var activeRow = document.querySelector('.report_row.active-report');
            if (activeRow !== null) {
                var ReportId = activeRow.dataset.id;
                if (ReportId) {
                    var deleteForm = document.getElementById('deleteReport');
                    deleteForm.action = '/delete-report/' + ReportId;
                    addCsrfTokenToForm(deleteForm);
                }
            } else {
                alert('Выберите отчет для удаления');
                event.preventDefault();
            }
        });
   }


    if(document.getElementById('del_reportButton')){
        const controlVersionButton = document.getElementById('control_versionButton');
        controlVersionButton.addEventListener('click', function(event) {
            var activeControlRow = document.querySelector('.report_row.active-report');
            if (activeControlRow !== null) {
                var controlForm = document.getElementById('control-version-form');
                var id = activeControlRow.dataset.versionId;
                if (id) {
                    controlForm.action = '/control-version/' + id;
                    addCsrfTokenToForm(controlForm);
                    controlForm.submit();
                }
            } else {
                event.preventDefault();
            }
        });
    }

    if(document.getElementById('agreedVersionButton')){
        const agreedVersionButton = document.getElementById('agreedVersionButton');
        agreedVersionButton.addEventListener('click', function(event) {
            var activeRow = document.querySelector('.report_row.active-report');
            if (activeRow !== null) {
                var agreedForm = document.getElementById('agreed-version-form');
                var id = activeRow.dataset.versionId;
                if (id) {
                    agreedForm.action = '/agreed-version/' + id;
                    addCsrfTokenToForm(agreedForm);
                    agreedForm.submit();
                }
            } else {
                event.preventDefault();
            }
        });
    }

    if(document.getElementById('export_versionButton')){
        const exportVersionButton = document.getElementById('export_versionButton');
        exportVersionButton.addEventListener('click', function(event) {
            var activeexportRow = document.querySelector('.report_row.active-report');
            if (activeexportRow !== null) {
                var exportForm = document.getElementById('export-version-form');
                var id = activeexportRow.dataset.versionId;
                if (id) {
                    exportForm.action = '/export-version/' + id;
                    addCsrfTokenToForm(exportForm);
                    exportForm.submit();
                }
            } else {
                event.preventDefault();
            }
        });
    }

    if(document.getElementById('toTicketsBtn')){
        const toTicketsBtn = document.getElementById('toTicketsBtn');
        toTicketsBtn.addEventListener('click', function(event) {
            var activeRow = document.querySelector('.report_row.active-report');
            if (activeRow !== null) {
                var id = activeRow.dataset.versionId;
                if (id) {
                    window.location.href = '/reports/report-info/' + id;
                }
            } else {
                event.preventDefault();
            }
        });
    }
});

document.addEventListener('DOMContentLoaded', function() {
    const dropArea = document.getElementById("drop-area");
    const fileInput = document.getElementById("certificate_to_check");

    var send_button = document.getElementById('send_button');
    var sentForm = document.getElementById('sentForm');


    if (document.getElementById('agreedVersionButton') || 
        document.getElementById('control_versionButton') || 
        document.getElementById('sentVersionButton') || 
        document.getElementById('export_versionButton') || 
        document.getElementById('toTicketsBtn')) {
        updateHeaderButtonStyle(false, false, false, false, false);
    }
    
    if(dropArea){
        dropArea.addEventListener("click", function () {
            fileInput.click();
        });


        fileInput.addEventListener("change", function () {
            handleFiles(fileInput.files);
        });

        ["dragenter", "dragover", "dragleave", "drop"].forEach(eventName => {
            dropArea.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ["dragenter", "dragover"].forEach(eventName => {
            dropArea.addEventListener(eventName, () => dropArea.classList.add("highlight"), false);
        });
        
        ["dragleave", "drop"].forEach(eventName => {
            dropArea.addEventListener(eventName, () => dropArea.classList.remove("highlight"), false);
        });

        dropArea.addEventListener("drop", function (e) {
            const files = e.dataTransfer.files;
            fileInput.files = files;
            handleFiles(files);
        });

        function handleFiles(files) {
            if (files.length > 0) {
                dropArea.querySelector("p").textContent = `Выбран файл: ${files[0].name}`;
            }
        }

        send_button.addEventListener('click', function(event) {
            var reportIdNull = document.getElementById('report-id-null');
            var reportIdNullValue = reportIdNull ? reportIdNull.value.trim() : '';
            
            if (reportIdNullValue !== '') {
                sentForm.action = '/send-version/' + reportIdNullValue;
            } else {
                var activeRow = document.querySelector('.report_row.active-report');
                if (activeRow !== null) {
                    var id = activeRow.dataset.versionId;
                    if (id) {
                        sentForm.action = '/send-version/' + id;
                    } else {
                        event.preventDefault();
                        alert('Не найден ID версии для отправки!');
                    }
                } else {
                    event.preventDefault();
                    alert('Выберите отчет перед отправкой!');
                }
            }
        });
    }
   
});

/* change pozition modal */
document.addEventListener('DOMContentLoaded', (event) => {
    const headers = document.querySelectorAll(".change-position");
    headers.forEach(header => {
        const modal = header.closest('.modal-content');

        let isDragging = false;
        let startX, startY, initialX, initialY;

        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = modal.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;
            modal.style.position = "absolute";
            modal.style.margin = 0;
            document.body.style.userSelect = 'none';
        });
        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                modal.style.left = `${initialX + dx}px`;
                modal.style.top = `${initialY + dy}px`;
            }
        });
        document.addEventListener('mouseup', () => {
            isDragging = false;
            document.body.style.userSelect = 'auto';
        });
    });
});

function handleModal(modalId, linkId) {
    const modal = modalId;
    const openLink = linkId;
    if (modal && openLink) {
        const closeBtn = modal.querySelector('.close');
        openLink.addEventListener('click', (event) => {
            if (openLink.style.opacity === '0.5') {
                event.preventDefault();
            } else {
                modal.classList.add('active');
            }
        });
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.classList.remove('active');
            });
        }
        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.classList.remove('active');
            }
        });
    }
}

if (document.getElementById('link_stats')) {
    handleModal(document.getElementById('load_stats_modal'), document.getElementById('link_stats'));
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

function setCookie(name, value, days) {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
}

if (window.location.pathname.includes('/FAQ')) {
    setCookie('faq_visited', 'true', 365);
}

document.addEventListener('DOMContentLoaded', function() {
    const phoneElements = document.querySelectorAll('.phone-hidden');
    
    if (getCookie('faq_visited') === 'true') {
        phoneElements.forEach(phone => {
            phone.classList.remove('phone-hidden');
        });
    }
    
    const faqLinks = document.querySelectorAll('.faq-link');
    faqLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.stopPropagation();
            window.location.href = '/FAQ';
        });
    });
    
    phoneElements.forEach(phone => {
        phone.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = '/FAQ';
        });
    });
});

(function() {
    const rollers = document.querySelectorAll('.counter-roller');
    if (!rollers.length) return;
    
    const ITEM_HEIGHT = 75;
    
    const createDigitWheel = (digit) => {
        const wheel = document.createElement('div');
        wheel.className = 'digit-wheel';
        
        const wrapper = document.createElement('div');
        wrapper.className = 'digit-wrapper';
        
        for (let i = 0; i <= 9; i++) {
            const span = document.createElement('span');
            span.textContent = i;
            wrapper.appendChild(span);
        }
        
        wheel.appendChild(wrapper);
        return { wheel, wrapper };
    };
    
    const formatNumber = (num) => {
        return num.toString().split('');
    };
    
    rollers.forEach(roller => {
        const target = parseInt(roller.getAttribute('data-target'));
        if (isNaN(target)) return;
        
        const digits = formatNumber(target);
        const container = roller.querySelector('.digits-container');
        container.innerHTML = '';
        
        const wheels = [];
        
        digits.forEach((digit, index) => {
            const { wheel, wrapper } = createDigitWheel(parseInt(digit));
            container.appendChild(wheel);
            wheels.push({
                wrapper,
                targetDigit: parseInt(digit),
                currentDigit: 0
            });
        });
        
        roller.wheels = wheels;
        roller.targetValue = target;
    });
    
    let animated = false;
    const startAnimation = () => {
        if (animated) return;
        animated = true;
        
        setTimeout(() => {
            rollers.forEach((roller, rollerIndex) => {
                const wheels = roller.wheels;
                if (!wheels) return;
                
                wheels.forEach((wheel, wheelIndex) => {
                    setTimeout(() => {
                        const targetDigit = wheel.targetDigit;
                        const rotations = 2;
                        const totalSteps = rotations * 10 + targetDigit;
                        const offset = -(totalSteps % 10) * ITEM_HEIGHT;
                        
                        wheel.wrapper.style.transform = `translateY(${offset}px)`;
                    }, rollerIndex * 200 + wheelIndex * 150);
                });
            });
        }, 300);
    };
    
    const observer = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting)) {
            startAnimation();
            observer.disconnect();
        }
    }, { threshold: 0.3 });
    
    const statsRow = document.querySelector('.statistics-row');
    statsRow ? observer.observe(statsRow) : startAnimation();
})();

