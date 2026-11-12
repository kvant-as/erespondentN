// Ввод номеров телефона с кодом оператора или города — тот же компонент, что в enPlans (static/js/base.js, PhoneGroupInput).
class PhoneGroupInput {
    static CODES = [
        { code: '29', label: 'A1', group: 'Операторы' },
        { code: '33', label: 'МТС', group: 'Операторы' },
        { code: '44', label: 'life:)', group: 'Операторы' },
        { code: '25', label: 'МТС', group: 'Операторы' },
        { code: '17', label: 'Минск', group: 'Города' },
        { code: '162', label: 'Брест', group: 'Города' },
        { code: '212', label: 'Витебск', group: 'Города' },
        { code: '232', label: 'Гомель', group: 'Города' },
        { code: '152', label: 'Гродно', group: 'Города' },
        { code: '222', label: 'Могилёв', group: 'Города' }
    ];

    constructor(listEl, hiddenInput, addButton, options = {}) {
        this.listEl = listEl;
        this.hiddenInput = hiddenInput;
        this.addButton = addButton;
        this.options = {
            countryCode: '+375',
            totalDigits: 12,
            maxCount: 2,
            inputClass: 'auth-input',
            onChange: null,
            ...options
        };
        this.countryDigits = this.options.countryCode.replace(/\D/g, '');

        if (!this.listEl) return;

        this.bindEvents();
        this.init();
    }

    notifyChange() {
        if (typeof this.options.onChange === 'function') {
            this.options.onChange();
        }
    }

    init() {
        const existing = this.listEl.dataset.existingPhones;
        if (existing !== undefined) {
            this.listEl.innerHTML = '';
            const numbers = existing.split(';').map(s => s.trim()).filter(Boolean);
            if (numbers.length === 0) {
                this.listEl.appendChild(this.createRow());
            } else {
                numbers.slice(0, this.options.maxCount).forEach(num => {
                    this.listEl.appendChild(this.createRow(this.parseExistingNumber(num)));
                });
            }
        }

        this.listEl.querySelectorAll('.phone-row').forEach(row => this.updateRowConstraints(row));
        this.refreshControls();
        this.validate();
    }

    parseExistingNumber(num) {
        const digitsOnly = num.replace(/\D/g, '');
        let rest = digitsOnly;
        if (rest.startsWith(this.countryDigits)) {
            rest = rest.slice(this.countryDigits.length);
        }
        const sortedCodes = [...PhoneGroupInput.CODES].sort((a, b) => b.code.length - a.code.length);
        const match = sortedCodes.find(c => rest.startsWith(c.code));
        if (match) {
            return { code: match.code, digits: rest.slice(match.code.length) };
        }
        return { code: PhoneGroupInput.CODES[0].code, digits: rest };
    }

    bindEvents() {
        if (this.addButton) {
            this.addButton.addEventListener('click', () => this.addRow());
        }

        this.listEl.addEventListener('input', (e) => {
            if (e.target.classList.contains('phone-digits-input')) {
                this.sanitizeDigitsInput(e.target);
            }
            this.validate();
            this.notifyChange();
        });

        this.listEl.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('.phone-row-remove');
            if (removeBtn) {
                this.removeRow(removeBtn.closest('.phone-row'));
                return;
            }

            const option = e.target.closest('.phone-code-option');
            if (option) {
                this.selectCode(option);
                return;
            }

            const trigger = e.target.closest('.phone-code-trigger');
            if (trigger) {
                this.toggleDropdown(trigger.closest('.phone-code-select'));
                return;
            }

            this.closeAllDropdowns();
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.phone-code-select')) {
                this.closeAllDropdowns();
            }
        });
    }

    sanitizeDigitsInput(input) {
        const cleaned = input.value.replace(/\D/g, '');
        if (cleaned !== input.value) {
            input.value = cleaned;
        }
    }

    getRowCode(row) {
        const select = row.querySelector('.phone-code-select');
        if (!select) return '';
        return select.dataset.code || '';
    }

    updateRowConstraints(row) {
        if (!row) return;
        const input = row.querySelector('.phone-digits-input');
        if (!input) return;
        const code = this.getRowCode(row);
        const maxDigits = Math.max(0, this.options.totalDigits - this.countryDigits.length - code.length);
        input.maxLength = maxDigits;
    }

    validate() {
        const rows = Array.from(this.listEl.querySelectorAll('.phone-row'));
        const validNumbers = [];
        let allFilledValid = true;
        let hasAtLeastOne = false;

        rows.forEach(row => {
            const input = row.querySelector('.phone-digits-input');
            if (!input) return;

            const digitsOnly = input.value.replace(/\D/g, '');
            row.classList.remove('invalid');

            if (!digitsOnly) {
                return;
            }

            hasAtLeastOne = true;
            const code = this.getRowCode(row);
            const totalDigits = this.countryDigits.length + code.length + digitsOnly.length;

            if (totalDigits === this.options.totalDigits) {
                validNumbers.push(this.options.countryCode + code + digitsOnly);
            } else {
                row.classList.add('invalid');
                allFilledValid = false;
            }
        });

        const isValid = hasAtLeastOne && allFilledValid;
        if (this.hiddenInput) {
            this.hiddenInput.value = isValid ? validNumbers.join('; ') : '';
        }
        return isValid;
    }

    addRow() {
        const currentCount = this.listEl.querySelectorAll('.phone-row').length;
        if (currentCount >= this.options.maxCount) return;

        const row = this.createRow();
        this.listEl.appendChild(row);
        this.updateRowConstraints(row);
        this.refreshControls();
        this.validate();
        this.notifyChange();
    }

    removeRow(row) {
        if (!row) return;
        row.remove();
        this.refreshControls();
        this.validate();
        this.notifyChange();
    }

    refreshControls() {
        const rows = this.listEl.querySelectorAll('.phone-row');
        rows.forEach(row => {
            const removeBtn = row.querySelector('.phone-row-remove');
            if (removeBtn) {
                removeBtn.style.display = rows.length > 1 ? 'inline-flex' : 'none';
            }
        });

        if (this.addButton) {
            const atMax = rows.length >= this.options.maxCount;
            this.addButton.style.display = atMax ? 'none' : 'inline-flex';
        }
    }

    toggleDropdown(select) {
        if (!select) return;
        const isOpen = select.classList.contains('open');
        this.closeAllDropdowns();
        if (!isOpen) {
            select.classList.add('open');
            const trigger = select.querySelector('.phone-code-trigger');
            if (trigger) trigger.setAttribute('aria-expanded', 'true');
        }
    }

    closeAllDropdowns() {
        this.listEl.querySelectorAll('.phone-code-select.open').forEach(select => {
            select.classList.remove('open');
            const trigger = select.querySelector('.phone-code-trigger');
            if (trigger) trigger.setAttribute('aria-expanded', 'false');
        });
    }

    selectCode(optionEl) {
        const select = optionEl.closest('.phone-code-select');
        if (!select) return;

        const code = optionEl.dataset.code;
        select.dataset.code = code;

        select.querySelectorAll('.phone-code-option').forEach(opt => {
            opt.classList.toggle('selected', opt === optionEl);
        });

        const valueEl = select.querySelector('.phone-code-value');
        if (valueEl) {
            valueEl.textContent = `${this.options.countryCode} ${code}`;
        }

        this.closeAllDropdowns();

        const row = select.closest('.phone-row');
        this.updateRowConstraints(row);
        this.validate();
        this.notifyChange();
    }

    buildDropdownHtml(selectedCode) {
        let html = '';
        let currentGroup = null;
        PhoneGroupInput.CODES.forEach(({ code, label, group }) => {
            if (group !== currentGroup) {
                html += `<div class="phone-code-group-label">${group}</div>`;
                currentGroup = group;
            }
            const selectedClass = code === selectedCode ? ' selected' : '';
            html += `
                <button type="button" class="phone-code-option${selectedClass}" data-code="${code}" role="option">
                    <span>${this.options.countryCode} ${code}</span><span class="phone-code-hint">${label}</span>
                </button>
            `;
        });
        return html;
    }

    createRow(prefill) {
        const codeEntry = prefill
            ? (PhoneGroupInput.CODES.find(c => c.code === prefill.code) || PhoneGroupInput.CODES[0])
            : PhoneGroupInput.CODES[0];
        const digitsValue = prefill ? prefill.digits : '';

        const row = document.createElement('div');
        row.className = 'phone-row';
        row.setAttribute('data-phone-row', '');
        row.innerHTML = `
            <div class="phone-code-select" data-code="${codeEntry.code}">
                <button type="button" class="phone-code-trigger" aria-haspopup="listbox" aria-expanded="false">
                    <span class="phone-code-value">${this.options.countryCode} ${codeEntry.code}</span>
                    <svg class="phone-code-chevron" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6" />
                    </svg>
                </button>
                <div class="phone-code-dropdown" role="listbox">
                    ${this.buildDropdownHtml(codeEntry.code)}
                </div>
            </div>
            <input type="text" class="phone-digits-input ${this.options.inputClass}" inputmode="numeric" autocomplete="off" placeholder="Номер телефона" value="${digitsValue}" />
            <button type="button" class="phone-row-remove" aria-label="Удалить номер">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            </button>
        `;
        return row;
    }
}

window.PhoneGroupInput = PhoneGroupInput;
