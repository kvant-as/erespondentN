document.addEventListener('DOMContentLoaded', function () {
    function getURLParameter(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    }
    const modalId = getURLParameter('modal');
    if (modalId) {
        const modalElement = document.getElementById(modalId);
        if (modalElement) {
            modalElement.classList.add('active');
        } else {
            console.error(`Модальное окно с id '${modalId}' не найдено.`);
        }
    }
});

function updateCounter(textarea) {
    const counter = document.getElementById('messageCounter');
    const submitBtn = document.querySelector('.blue_btn');
    const currentLength = textarea.value.length;
    const maxLength = parseInt(textarea.getAttribute('maxlength'));
    
    counter.textContent = currentLength + '/' + maxLength;
    
    if (currentLength > maxLength * 0.9) {
        counter.style.color = '#ef4444';
    } else if (currentLength > maxLength * 0.7) {
        counter.style.color = '#f59e0b';
    } else {
        counter.style.color = '#a0aec0';
    }

    if (submitBtn && !submitBtn.hasAttribute('data-permanently-disabled')) {
        const hasText = currentLength > 0;
        const isStatusDisabled = submitBtn.hasAttribute('data-status-disabled');
        
        if (!isStatusDisabled) {
            if (hasText) {
                submitBtn.removeAttribute('disabled');
            } else {
                submitBtn.setAttribute('disabled', 'disabled');
            }
        }
    }
}

function scrollToTickets() {
    const formElement = document.getElementById('ticket-area');
    if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth' });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    var urladdComment_modal = new URLSearchParams(window.location.search);
    if (urladdComment_modal.get('tickets_cont') === 'true') {
        if (document.getElementById('ticket-area')) {
            scrollToTickets();
        }
    }
    
    const sectionLinks = document.querySelectorAll('[data-section]');
    sectionLinks.forEach(link => {
        link.addEventListener('click', function() {
            const sectionId = this.getAttribute('data-section').replace('link', 'table');
            sectionLinks.forEach(item => {
                item.classList.remove('active_functions_menu');
            });
            this.classList.add('active_functions_menu');

            document.querySelectorAll('.report-area > div').forEach(div => {
                div.style.display = 'none';
            });

            const sectionToShow = document.getElementById(sectionId);
            if (sectionToShow) {
                sectionToShow.style.display = 'block';
            }
        });
    });



    function initTableKeyboardNavigation() {
        let currentActiveIndex = -1;
        let previousActiveRow = null;
        
        function getVisibleTableRows() {
            const tables = ['fuel_section_table', 'heat_section_table', 'electro_section_table'];
            
            for (const tableId of tables) {
                const table = document.getElementById(tableId);
                if (table && table.style.display !== 'none') {
                    return table.querySelectorAll('.section_row');
                }
            }
            return [];
        }
        
        document.addEventListener('click', function(event) {
            const row = event.target.closest('.section_row');
            if (row && event.button === 0) {
                const rows = getVisibleTableRows();
                
                if (Array.from(rows).includes(row)) {
                    const index = Array.from(rows).indexOf(row);
                    selectRow(row, index);
                }
            }
        });
        
        function selectRow(row, index) {
            const rows = getVisibleTableRows();
            
            row.focus();
            
            if (row.classList.contains('active-report')) {
                row.classList.remove('active-report');
                row.querySelectorAll('input').forEach(input => {
                    input.classList.remove('active-input');
                });
                previousActiveRow = null;
                currentActiveIndex = -1;
            } else {
                if (previousActiveRow !== null) {
                    previousActiveRow.classList.remove('active-report');
                    previousActiveRow.querySelectorAll('input').forEach(input => {
                        input.classList.remove('active-input');
                    });
                }
                
                row.classList.add('active-report');
                row.querySelectorAll('input').forEach(input => {
                    input.classList.add('active-input');
                });
                previousActiveRow = row;
                currentActiveIndex = index;
            }
        }
        
        document.addEventListener('keydown', function(event) {
            const rows = getVisibleTableRows();
            if (rows.length === 0) return;
            
            switch(event.key) {
                case 'ArrowDown':
                    event.preventDefault();
                    if (currentActiveIndex === -1) {
                        selectRow(rows[0], 0);
                    } else {
                        const newIndex = (currentActiveIndex + 1) % rows.length;
                        selectRow(rows[newIndex], newIndex);
                    }
                    break;
                    
                case 'ArrowUp':
                    event.preventDefault();
                    if (currentActiveIndex === -1) {
                        selectRow(rows[rows.length - 1], rows.length - 1);
                    } else {
                        const newIndex = (currentActiveIndex - 1 + rows.length) % rows.length;
                        selectRow(rows[newIndex], newIndex);
                    }
                    break;
                    
                case 'Home':
                    event.preventDefault();
                    if (rows.length > 0 && (currentActiveIndex !== 0 || previousActiveRow === null)) {
                        selectRow(rows[0], 0);
                    }
                    break;
                    
                case 'End':
                    event.preventDefault();
                    if (rows.length > 0) {
                        const lastIndex = rows.length - 1;
                        if (currentActiveIndex !== lastIndex || previousActiveRow === null) {
                            selectRow(rows[lastIndex], lastIndex);
                        }
                    }
                    break;
                    
                case 'Escape':
                    if (previousActiveRow) {
                        previousActiveRow.classList.remove('active-report');
                        previousActiveRow.querySelectorAll('input').forEach(input => {
                            input.classList.remove('active-input');
                        });
                        previousActiveRow = null;
                        currentActiveIndex = -1;
                    }
                    break;
                    
                case ' ':
                    if (event.target.classList.contains('section_row')) {
                        event.preventDefault();
                        const row = event.target;
                        const rows = getVisibleTableRows();
                        const index = Array.from(rows).indexOf(row);
                        if (index !== -1) {
                            selectRow(row, index);
                        }
                    }
                    break;
            }
        });
        
        function setupRows() {
            document.querySelectorAll('.section_row').forEach(row => {
                row.setAttribute('tabindex', '-1');
            });
        }
        
        setupRows();
        
        return {
            selectRowByIndex: function(index) {
                const rows = getVisibleTableRows();
                if (index >= 0 && index < rows.length) {
                    selectRow(rows[index], index);
                }
            },
            
            getActiveRow: function() {
                return {
                    element: previousActiveRow,
                    index: currentActiveIndex
                };
            },
            
            clearSelection: function() {
                if (previousActiveRow) {
                    previousActiveRow.classList.remove('active-report');
                    previousActiveRow.querySelectorAll('input').forEach(input => {
                        input.classList.remove('active-input');
                    });
                    previousActiveRow = null;
                    currentActiveIndex = -1;
                }
            }
        };
    }

    const tableNav = initTableKeyboardNavigation();

    function switchToFuelTable() {
        document.getElementById('fuel_section_table').style.display = '';
        document.getElementById('heat_section_table').style.display = 'none';
        document.getElementById('electro_section_table').style.display = 'none';
        tableNav.clearSelection();
    }

    function switchToHeatTable() {
        document.getElementById('fuel_section_table').style.display = 'none';
        document.getElementById('heat_section_table').style.display = '';
        document.getElementById('electro_section_table').style.display = 'none';
        tableNav.clearSelection();
    }

    function switchToElectroTable() {
        document.getElementById('fuel_section_table').style.display = 'none';
        document.getElementById('heat_section_table').style.display = 'none';
        document.getElementById('electro_section_table').style.display = '';
        tableNav.clearSelection();
    }

    if (textareaAudit = document.querySelector('.message-field__textarea')) {
        updateCounter(textareaAudit);
    }

    const menuItems = document.querySelectorAll('.functions_menu li');
    const actionInputAuditReport = document.getElementById('action-input');
    const statusForm = document.getElementById('change-status-form');
    
    menuItems.forEach(item => {
        item.addEventListener('click', function(event) {
            event.preventDefault();

            const action = this.dataset.action;

            if (actionInputAuditReport) {
                actionInputAuditReport.value = action;
            }

            if (statusForm) {
                statusForm.submit();
            }
        });
    });
});

document.getElementById('export-table-btn').addEventListener('click', function() {
    document.getElementById('export-table-form').submit();
});

