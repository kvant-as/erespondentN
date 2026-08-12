document.addEventListener('DOMContentLoaded', function() {
    const questionTypeSelect = document.getElementById('questionType');
    const form = document.getElementById('askquestion-form');
    const submitButton = document.getElementById('send-btn');
    
    const addNameInput = document.getElementById('organizationName');
    const addOkpoInput = document.getElementById('organizationOkpo');
    const addYnpInput = document.getElementById('organizationYnp');
    const addRegionHidden = document.getElementById('organizationRegion');
    const addRegionStatus = document.getElementById('addRegionSelectionStatus');
    const addRegionBtns = document.querySelectorAll('#addOrgFields .region-btn');
    
    const newNameInput = document.getElementById('newOrganizationName');
    const newOkpoInput = document.getElementById('newOrganizationOkpo');
    const newYnpInput = document.getElementById('newOrganizationYnp');
    const newRegionHidden = document.getElementById('newOrganizationRegion');
    const newRegionStatus = document.getElementById('newRegionSelectionStatus');
    const newRegionBtns = document.querySelectorAll('#newOrgData .region-btn');
    
    const addOrgFields = document.getElementById('addOrgFields');
    const organizationSearchBlock = document.getElementById('organizationSearchBlock');
    const newOrgData = document.getElementById('newOrgData');
    
    const organizationSearch = document.getElementById('organizationSearch');
    const searchResults = document.getElementById('searchResults');
    
    const selectedOrgId = document.getElementById('selectedOrgId');
    const organizationOldName = document.getElementById('organizationOldName');
    const organizationOldOkpo = document.getElementById('organizationOldOkpo');
    const organizationOldYnp = document.getElementById('organizationOldYnp');
    const organizationOldRegion = document.getElementById('organizationOldRegion');
    
    const oldNameHint = document.getElementById('oldNameHint');
    const oldYnpHint = document.getElementById('oldYnpHint');
    const oldOkpoHint = document.getElementById('oldOkpoHint');
    const oldRegionHint = document.getElementById('oldRegionHint');
    
    const nameStatusInline = document.getElementById('nameStatusInline');
    const ynpStatusInline = document.getElementById('ynpStatusInline');
    const okpoStatusInline = document.getElementById('okpoStatusInline');
    const regionStatusInline = document.getElementById('regionStatusInline');
    
    let searchTimeout = null;
    let currentPage = 1;
    let isLoading = false;
    let hasMore = true;

    function setupRegionButtons(btns, hiddenInput, statusElement) {
        btns.forEach(function(btn) {
            btn.addEventListener('click', function() {
                const value = this.dataset.value;
                const name = this.querySelector('.region-name').textContent;
                const number = this.dataset.number;
                
                btns.forEach(function(b) {
                    b.classList.remove('selected');
                });
                
                this.classList.add('selected');
                hiddenInput.value = value;
                statusElement.textContent = 'Выбран: ' + number + '. ' + name;
                statusElement.classList.add('selected');
                
                // Вызываем обновление сравнения и валидацию
                updateInlineComparison();
                validateForm();
            });
        });
    }

    setupRegionButtons(addRegionBtns, addRegionHidden, addRegionStatus);
    setupRegionButtons(newRegionBtns, newRegionHidden, newRegionStatus);

    function checkOkpoValidity(value) {
        if (value.length === 0) return true;
        if (value.length !== 12) return false;
        const fourthFromEnd = value[value.length - 4];
        const allowedDigits = ['1', '2', '3', '4', '5', '6', '7'];
        return allowedDigits.includes(fourthFromEnd);
    }

    function checkYnpValidity(value) {
        if (value.length === 0) return true;
        return value.length === 9;
    }

    function updateOkpoError(inputElement) {
        if (!inputElement) return;
        const value = inputElement.value;
        const existingError = document.getElementById('okpoError');
        if (existingError) existingError.remove();
        
        if (value.length === 0) {
            inputElement.classList.remove('input-error');
            return;
        }
        
        if (value.length !== 12) {
            inputElement.classList.add('input-error');
            const errorDiv = document.createElement('div');
            errorDiv.id = 'okpoError';
            errorDiv.style.color = 'red';
            errorDiv.style.fontSize = '12px';
            errorDiv.style.marginTop = '5px';
            errorDiv.textContent = 'ОКПО должен содержать 12 цифр';
            inputElement.parentNode.insertBefore(errorDiv, inputElement.nextSibling);
            return;
        }
        
        const fourthFromEnd = value[value.length - 4];
        const allowedDigits = ['1', '2', '3', '4', '5', '6', '7'];
        
        if (!allowedDigits.includes(fourthFromEnd)) {
            inputElement.classList.add('input-error');
            const errorDiv = document.createElement('div');
            errorDiv.id = 'okpoError';
            errorDiv.style.color = 'red';
            errorDiv.style.fontSize = '12px';
            errorDiv.style.marginTop = '5px';
            errorDiv.textContent = '4-я цифра с конца в коде ОКПО должна быть от 1 до 7';
            inputElement.parentNode.insertBefore(errorDiv, inputElement.nextSibling);
            return;
        }
        
        inputElement.classList.remove('input-error');
    }

    function updateYnpError(inputElement) {
        if (!inputElement) return;
        const value = inputElement.value;
        const existingError = document.getElementById('ynpError');
        if (existingError) existingError.remove();
        
        if (value.length === 0) {
            inputElement.classList.remove('input-error');
            return;
        }
        
        if (value.length !== 9) {
            inputElement.classList.add('input-error');
            const errorDiv = document.createElement('div');
            errorDiv.id = 'ynpError';
            errorDiv.style.color = 'red';
            errorDiv.style.fontSize = '12px';
            errorDiv.style.marginTop = '5px';
            errorDiv.textContent = 'УНП должен содержать ровно 9 цифр';
            inputElement.parentNode.insertBefore(errorDiv, inputElement.nextSibling);
            return;
        }
        
        inputElement.classList.remove('input-error');
    }

    function getRegionNameById(regionId) {
        if (!regionId) return '';
        const btn = document.querySelector('#newOrgData .region-btn[data-value="' + regionId + '"]');
        if (btn) {
            return btn.querySelector('.region-name').textContent;
        }
        // Проверяем также в блоках добавления
        const btnAdd = document.querySelector('#addOrgFields .region-btn[data-value="' + regionId + '"]');
        if (btnAdd) {
            return btnAdd.querySelector('.region-name').textContent;
        }
        return regionId;
    }

    function updateInlineComparison() {
        const oldName = organizationOldName.value;
        const oldYnp = organizationOldYnp.value;
        const oldOkpo = organizationOldOkpo.value;
        const oldRegion = organizationOldRegion.value;
        
        const newName = newNameInput ? newNameInput.value : '';
        const newYnp = newYnpInput ? newYnpInput.value : '';
        const newOkpo = newOkpoInput ? newOkpoInput.value : '';
        const newRegion = newRegionHidden ? newRegionHidden.value : '';
        
        if (oldNameHint) {
            if (oldName) {
                oldNameHint.textContent = '(старое: ' + oldName.substring(0, 40) + (oldName.length > 40 ? '...' : '') + ')';
            } else {
                oldNameHint.textContent = '';
            }
        }
        
        if (oldYnpHint) {
            if (oldYnp) {
                oldYnpHint.textContent = '(старый: ' + oldYnp + ')';
            } else {
                oldYnpHint.textContent = '(старое: Нет данных)';
            }
        }
        
        if (oldOkpoHint) {
            if (oldOkpo) {
                oldOkpoHint.textContent = '(старый: ' + oldOkpo + ')';
            } else {
                oldOkpoHint.textContent = '';
            }
        }

        if (oldRegionHint) {
            if (oldRegion) {
                const regionName = getRegionNameById(oldRegion);
                oldRegionHint.textContent = '(старый: ' + (regionName || oldRegion) + ')';
            } else {
                oldRegionHint.textContent = '';
            }
        }
        
        function getStatusHtml(oldVal, newVal, fieldName) {
            // Для региона обрабатываем особо, так как значения могут быть числами
            if (fieldName === 'Регион') {
                const oldStr = String(oldVal || '');
                const newStr = String(newVal || '');
                if (!oldStr) {
                    if (newStr) {
                        return '<span class="comparison-status-inline status-changed-inline">Будет добавлено</span>';
                    }
                    return '<span class="comparison-status-inline status-empty-inline">Ожидает выбора</span>';
                }
                if (!newStr) {
                    return '<span class="comparison-status-inline status-empty-inline">Ожидает выбора</span>';
                }
                if (oldStr !== newStr) {
                    return '<span class="comparison-status-inline status-changed-inline">✏️ ' + fieldName + ' будет изменено</span>';
                }
                return '<span class="comparison-status-inline status-unchanged-inline">✓ Без изменений</span>';
            }
            
            if (!oldVal) {
                if (newVal && newVal.trim() !== '') {
                    return '<span class="comparison-status-inline status-changed-inline">Будет добавлено</span>';
                }
                return '';
            }
            if (!newVal || newVal.trim() === '') {
                return '<span class="comparison-status-inline status-empty-inline">Ожидает ввода</span>';
            }
            if (oldVal !== newVal) {
                return '<span class="comparison-status-inline status-changed-inline">✏️ ' + fieldName + ' будет изменено</span>';
            }
            return '<span class="comparison-status-inline status-unchanged-inline">✓ Без изменений</span>';
        }
        
        if (nameStatusInline) {
            nameStatusInline.innerHTML = getStatusHtml(oldName, newName, 'Наименование');
        }
        if (ynpStatusInline) {
            ynpStatusInline.innerHTML = getStatusHtml(oldYnp, newYnp, 'УНП');
        }
        if (okpoStatusInline) {
            okpoStatusInline.innerHTML = getStatusHtml(oldOkpo, newOkpo, 'ОКПО');
        }
        if (regionStatusInline) {
            const oldRegionName = oldRegion ? getRegionNameById(oldRegion) : '';
            const newRegionName = newRegion ? getRegionNameById(newRegion) : '';
            regionStatusInline.innerHTML = getStatusHtml(oldRegionName, newRegionName, 'Регион');
        }
    }

    function validateForm() {
        const selectedValue = questionTypeSelect.value;
        
        if (selectedValue === '') {
            submitButton.disabled = true;
            submitButton.style.opacity = '0.5';
            return;
        } else {
            submitButton.disabled = false;
            submitButton.style.opacity = '1';
        }
        
        if (selectedValue === 'organization-none') {
            const nameValid = addNameInput && addNameInput.value.trim() !== '';
            const okpoValid = addOkpoInput && addOkpoInput.value.length === 12 && checkOkpoValidity(addOkpoInput.value);
            const ynpValid = addYnpInput && addYnpInput.value.length === 9;
            const regionValid = addRegionHidden && addRegionHidden.value !== '';
            
            submitButton.disabled = !(nameValid && okpoValid && ynpValid && regionValid);
            
        } else if (selectedValue === 'organization-edit') {
            const hasSelectedOrg = selectedOrgId.value !== '';
            
            let hasAnyValidChange = false;
            
            if (hasSelectedOrg) {
                const oldName = organizationOldName.value;
                const oldOkpo = organizationOldOkpo.value;
                const oldYnp = organizationOldYnp.value;
                const oldRegion = organizationOldRegion.value;
                
                const newName = newNameInput ? newNameInput.value.trim() : '';
                const newOkpo = newOkpoInput ? newOkpoInput.value.trim() : '';
                const newYnp = newYnpInput ? newYnpInput.value.trim() : '';
                const newRegion = newRegionHidden ? newRegionHidden.value : '';
                
                if (newName && newName !== oldName) {
                    hasAnyValidChange = true;
                }
                
                if (newOkpo && newOkpo !== oldOkpo) {
                    if (newOkpo.length === 12 && checkOkpoValidity(newOkpo)) {
                        hasAnyValidChange = true;
                    } else {
                        hasAnyValidChange = false;
                        submitButton.disabled = true;
                        submitButton.style.opacity = '0.5';
                        return;
                    }
                }
                
                if (newYnp && newYnp !== oldYnp) {
                    if (newYnp.length === 9) {
                        hasAnyValidChange = true;
                    } else {
                        hasAnyValidChange = false;
                        submitButton.disabled = true;
                        submitButton.style.opacity = '0.5';
                        return;
                    }
                }

                if (newRegion && newRegion !== oldRegion) {
                    hasAnyValidChange = true;
                }
            }
            
            submitButton.disabled = !(hasSelectedOrg && hasAnyValidChange);
            
        } else if (selectedValue === 'other') {
            const textareaValid = problemTextarea && problemTextarea.value.trim() !== '';
            submitButton.disabled = !textareaValid;
        }
        
        if (submitButton.disabled) {
            submitButton.style.opacity = '0.5';
        } else {
            submitButton.style.opacity = '1';
        }
    }

    function clearOrganizationSelection() {
        selectedOrgId.value = '';
        organizationOldName.value = '';
        organizationOldOkpo.value = '';
        organizationOldYnp.value = '';
        organizationOldRegion.value = '';
        
        if (newNameInput) newNameInput.value = '';
        if (newOkpoInput) newOkpoInput.value = '';
        if (newYnpInput) newYnpInput.value = '';
        if (newRegionHidden) newRegionHidden.value = '';
        if (newRegionStatus) {
            newRegionStatus.textContent = 'Регион не выбран';
            newRegionStatus.classList.remove('selected');
        }
        newRegionBtns.forEach(function(b) {
            b.classList.remove('selected');
        });
        if (organizationSearch) organizationSearch.value = '';
        if (newOrgData) newOrgData.style.display = 'none';
        
        updateInlineComparison();
        validateForm();
    }

    function selectOrganization(org) {
        selectedOrgId.value = org.id;
        organizationOldName.value = org.full_name;
        organizationOldOkpo.value = org.okpo || '';
        organizationOldYnp.value = org.ynp || '';
        organizationOldRegion.value = org.region_id || '';
        
        if (newNameInput) newNameInput.value = org.full_name;
        if (newOkpoInput) newOkpoInput.value = org.okpo || '';
        if (newYnpInput) newYnpInput.value = org.ynp || '';
        if (newRegionHidden && org.region_id) {
            newRegionHidden.value = org.region_id;
            newRegionBtns.forEach(function(b) {
                b.classList.remove('selected');
                if (b.dataset.value == org.region_id) {
                    b.classList.add('selected');
                }
            });
            const btn = document.querySelector('#newOrgData .region-btn[data-value="' + org.region_id + '"]');
            if (btn) {
                const name = btn.querySelector('.region-name').textContent;
                const number = btn.dataset.number;
                newRegionStatus.textContent = 'Выбран: ' + number + '. ' + name;
                newRegionStatus.classList.add('selected');
            }
        }
        
        if (organizationSearch) organizationSearch.value = org.full_name;
        if (searchResults) {
            searchResults.innerHTML = '';
            searchResults.classList.remove('show');
        }
        
        if (newOrgData) newOrgData.style.display = 'block';
        
        updateInlineComparison();
        validateForm();
    }

    async function searchOrganizations(query, page) {
        page = page || 1;
        if (!query.trim() || query.length < 2) {
            if (searchResults) {
                searchResults.innerHTML = '';
                searchResults.classList.remove('show');
            }
            return;
        }
        
        if (isLoading) return;
        isLoading = true;
        
        if (page === 1 && searchResults) {
            searchResults.innerHTML = '<div class="search-loading">Поиск...</div>';
            searchResults.classList.add('show');
        }
        
        try {
            const response = await fetch('/api/organizations?q=' + encodeURIComponent(query) + '&page=' + page);
            const data = await response.json();
            
            if (page === 1 && searchResults) {
                searchResults.innerHTML = '';
            }
            
            if (data.organizations.length === 0 && page === 1 && searchResults) {
                searchResults.innerHTML = '<div class="search-loading">Ничего не найдено</div>';
                hasMore = false;
            } else if (searchResults) {
                data.organizations.forEach(function(org) {
                    const item = document.createElement('div');
                    item.className = 'search-result-item';
                    item.innerHTML = '<div class="search-result-name">' + escapeHtml(org.full_name) + '</div><div class="search-result-details"><span class="search-result-okpo">ОКПО: ' + (org.okpo || '—') + '</span><span class="search-result-ynp">УНП: ' + (org.ynp || '—') + '</span><span class="search-result-region">Регион: ' + (org.region_name || '—') + '</span></div>';
                    item.addEventListener('click', function() {
                        selectOrganization(org);
                    });
                    searchResults.appendChild(item);
                });
                
                hasMore = data.has_next;
                currentPage = data.page;
            }
            
            if (searchResults && searchResults.children.length > 0) {
                searchResults.classList.add('show');
            }
            
        } catch (error) {
            console.error('Ошибка поиска:', error);
            if (page === 1 && searchResults) {
                searchResults.innerHTML = '<div class="search-loading">Ошибка при поиске</div>';
            }
        } finally {
            isLoading = false;
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    if (organizationSearch) {
        organizationSearch.addEventListener('input', function(e) {
            clearTimeout(searchTimeout);
            const query = e.target.value;
            
            if (selectedOrgId.value) {
                clearOrganizationSelection();
            }
            
            searchTimeout = setTimeout(function() {
                if (query.length >= 2) {
                    searchOrganizations(query, 1);
                } else if (searchResults) {
                    searchResults.innerHTML = '';
                    searchResults.classList.remove('show');
                }
            }, 300);
        });

        organizationSearch.addEventListener('focus', function() {
            if (organizationSearch.value.length >= 2 && searchResults && searchResults.children.length > 0) {
                searchResults.classList.add('show');
            }
        });
    }

    document.addEventListener('click', function(e) {
        if (organizationSearchBlock && !organizationSearchBlock.contains(e.target)) {
            if (searchResults) searchResults.classList.remove('show');
        }
    });

    if (addYnpInput) {
        addYnpInput.addEventListener('input', function(e) {
            let value = this.value.replace(/[^\d]/g, '');
            if (value.length > 9) value = value.slice(0, 9);
            this.value = value;
            updateYnpError(this);
            validateForm();
        });
    }

    if (addOkpoInput) {
        addOkpoInput.addEventListener('input', function(e) {
            let value = this.value.replace(/[^\d]/g, '');
            if (value.length > 12) value = value.slice(0, 12);
            this.value = value;
            updateOkpoError(this);
            validateForm();
        });
    }

    if (newYnpInput) {
        newYnpInput.addEventListener('input', function(e) {
            let value = this.value.replace(/[^\d]/g, '');
            if (value.length > 9) value = value.slice(0, 9);
            this.value = value;
            updateYnpError(this);
            updateInlineComparison();
            validateForm();
        });
    }

    if (newOkpoInput) {
        newOkpoInput.addEventListener('input', function(e) {
            let value = this.value.replace(/[^\d]/g, '');
            if (value.length > 12) value = value.slice(0, 12);
            this.value = value;
            updateOkpoError(this);
            updateInlineComparison();
            validateForm();
        });
    }

    if (newNameInput) {
        newNameInput.addEventListener('input', function() {
            updateInlineComparison();
            validateForm();
        });
    }

    const problemTextarea = document.getElementById('problemDescription');

    function updateFieldsVisibility() {
        const selectedValue = questionTypeSelect.value;
        
        if (addOrgFields) addOrgFields.style.display = 'none';
        if (organizationSearchBlock) organizationSearchBlock.style.display = 'none';
        if (newOrgData) newOrgData.style.display = 'none';
        if (problemTextarea && problemTextarea.closest) {
            problemTextarea.closest('.form-group').style.display = 'none';
        }
        
        document.querySelectorAll('.input-error').forEach(function(el) {
            el.classList.remove('input-error');
        });
        const okpoError = document.getElementById('okpoError');
        const ynpError = document.getElementById('ynpError');
        if (okpoError) okpoError.remove();
        if (ynpError) ynpError.remove();
        
        if (selectedValue === '') {
            if (problemTextarea && problemTextarea.closest) {
                problemTextarea.closest('.form-group').style.display = 'block';
                problemTextarea.required = true;
            }
            if (addNameInput) {
                addNameInput.required = false;
                addNameInput.removeAttribute('required');
            }
            if (addOkpoInput) {
                addOkpoInput.required = false;
                addOkpoInput.removeAttribute('required');
            }
            if (addYnpInput) {
                addYnpInput.required = false;
                addYnpInput.removeAttribute('required');
            }
            submitButton.disabled = true;
            submitButton.style.opacity = '0.5';
            
        } else if (selectedValue === 'organization-none') {
            if (addOrgFields) addOrgFields.style.display = 'block';
            if (addNameInput) {
                addNameInput.required = true;
                addNameInput.setAttribute('required', 'required');
            }
            if (addOkpoInput) {
                addOkpoInput.required = true;
                addOkpoInput.setAttribute('required', 'required');
            }
            if (addYnpInput) {
                addYnpInput.required = true;
                addYnpInput.setAttribute('required', 'required');
            }
            if (problemTextarea) problemTextarea.required = false;
            submitButton.disabled = false;
            submitButton.style.opacity = '1';
            validateForm();
            
        } else if (selectedValue === 'organization-edit') {
            if (organizationSearchBlock) organizationSearchBlock.style.display = 'block';
            if (newNameInput) newNameInput.required = false;
            if (newOkpoInput) newOkpoInput.required = false;
            if (newYnpInput) newYnpInput.required = false;
            if (problemTextarea) problemTextarea.required = false;
            
            if (addNameInput) {
                addNameInput.required = false;
                addNameInput.removeAttribute('required');
            }
            if (addOkpoInput) {
                addOkpoInput.required = false;
                addOkpoInput.removeAttribute('required');
            }
            if (addYnpInput) {
                addYnpInput.required = false;
                addYnpInput.removeAttribute('required');
            }
            
            submitButton.disabled = false;
            submitButton.style.opacity = '1';
            if (selectedOrgId && selectedOrgId.value) {
                if (newOrgData) newOrgData.style.display = 'block';
            }
            validateForm();
            
        } else if (selectedValue === 'other') {
            if (problemTextarea && problemTextarea.closest) {
                problemTextarea.closest('.form-group').style.display = 'block';
                problemTextarea.required = true;
            }
            if (addNameInput) {
                addNameInput.required = false;
                addNameInput.removeAttribute('required');
            }
            if (addOkpoInput) {
                addOkpoInput.required = false;
                addOkpoInput.removeAttribute('required');
            }
            if (addYnpInput) {
                addYnpInput.required = false;
                addYnpInput.removeAttribute('required');
            }
            if (newNameInput) newNameInput.required = false;
            if (newOkpoInput) newOkpoInput.required = false;
            if (newYnpInput) newYnpInput.required = false;
            submitButton.disabled = false;
            submitButton.style.opacity = '1';
            validateForm();
        }
    }
    
    if (addNameInput) addNameInput.addEventListener('input', validateForm);
    if (addYnpInput) addYnpInput.addEventListener('input', validateForm);
    if (addOkpoInput) addOkpoInput.addEventListener('input', validateForm);
    if (problemTextarea) problemTextarea.addEventListener('input', validateForm);
    if (questionTypeSelect) questionTypeSelect.addEventListener('change', updateFieldsVisibility);
    
    updateFieldsVisibility();
});