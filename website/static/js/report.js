document.addEventListener('DOMContentLoaded', function() {
    var previousfuelRow = null;
    var selectedfuelId = null;
    var contextMenu_report = document.getElementById('contextMenu_report');
    var remove_section = document.getElementById('remove_section');
    var link_changefuel_modal = document.getElementById('link_changefuel_modal');
    var longPressTimer = null;
    var LONG_PRESS_DELAY = 500;
    var isLongPress = false;

    // ------------------------------------------------------------------
    //  Вспомогательное
    // ------------------------------------------------------------------
    function notify(message, ok) {
        if (typeof messageFlash !== 'undefined' && message) {
            messageFlash.addMessage(message, ok ? 'success' : 'error');
        } else if (message && !ok) {
            alert(message);
        }
    }

    // Форма Добавить/Редактировать/Удалить раньше делала обычный POST с
    // редиректом — вся страница перезагружалась и позиция прокрутки в
    // длинной таблице сбрасывалась. Теперь запрос уходит через fetch, а
    // обновляется только тело таблицы (см. refreshSectionsTable). На время
    // операции держим прокрутку "прибитой" — снятие фокуса с кнопки/закрытие
    // модалки в некоторых браузерах само прокручивает страницу к началу.
    async function withScrollPreserved(fn) {
        var scrollY = window.scrollY;
        var active = true;
        var onScroll = function() {
            if (active && window.scrollY !== scrollY) window.scrollTo(0, scrollY);
        };
        window.addEventListener('scroll', onScroll);
        try {
            return await fn();
        } finally {
            if (window.scrollY !== scrollY) window.scrollTo(0, scrollY);
            setTimeout(function() {
                active = false;
                window.removeEventListener('scroll', onScroll);
            }, 1500);
        }
    }

    async function ajaxSubmit(form, onSuccess) {
        return await withScrollPreserved(async function() {
            var submitBtn = form.querySelector('button[type="submit"]');
            var wasDisabled = submitBtn ? submitBtn.disabled : null;
            if (submitBtn) submitBtn.disabled = true;
            try {
                var resp = await fetch(form.action, {
                    method: 'POST',
                    headers: { 'X-Requested-With': 'XMLHttpRequest' },
                    body: new FormData(form)
                });
                var json = null;
                try { json = await resp.json(); } catch (e) { json = null; }

                if (json && typeof json.success === 'boolean') {
                    notify(json.message, json.success);
                    if (json.success && typeof onSuccess === 'function') {
                        await onSuccess();
                    }
                    return json.success;
                }
                // Ответ не JSON (напр. редирект авторизации) — ведём себя как раньше.
                window.location.reload();
                return false;
            } catch (e) {
                console.error('[report] ajaxSubmit error', e);
                notify('Не удалось выполнить операцию', false);
                return false;
            } finally {
                if (submitBtn) submitBtn.disabled = wasDisabled;
            }
        });
    }

    function currentReportRoute() {
        var table = document.getElementById('fuel-table-report');
        if (table && table.dataset.reportType && table.dataset.versionId) {
            return { type: table.dataset.reportType, id: table.dataset.versionId };
        }
        var m = window.location.pathname.match(/\/reports\/(fuel|heat|electro)\/(\d+)/);
        return m ? { type: m[1], id: m[2] } : null;
    }

    // Перерисовывает только тело таблицы раздела и заново навешивает
    // обработчики строк — узлы строк каждый раз новые.
    async function refreshSectionsTable() {
        var route = currentReportRoute();
        var tbody = document.getElementById('sections-tbody');
        if (!route || !tbody) return;
        try {
            var resp = await fetch('/reports/' + route.type + '/' + route.id + '/partial/rows', {
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });
            if (!resp.ok) return;
            tbody.innerHTML = await resp.text();
        } catch (e) {
            console.error('[report] refreshSectionsTable error', e);
            return;
        }
        selectedfuelId = null;
        previousfuelRow = null;
        if (remove_section) remove_section.disabled = true;
        if (link_changefuel_modal) link_changefuel_modal.disabled = true;
        bindSectionRows();
        syncPodRowActions();
    }

    // ------------------------------------------------------------------
    //  Выбор строки + контекстное меню
    // ------------------------------------------------------------------
    function showContextMenu(event, row, index) {
        event.preventDefault();
        if (!contextMenu_report) return;
        if (row.dataset.id) {
            if (!row.classList.contains('active-report')) {
                selectRow(row, index);
            }

            var pageX, pageY;
            if (event.touches) {
                pageX = event.touches[0].pageX;
                pageY = event.touches[0].pageY;
            } else {
                pageX = event.pageX;
                pageY = event.pageY;
            }

            contextMenu_report.style.top = pageY + 'px';
            contextMenu_report.style.left = pageX + 'px';
            contextMenu_report.style.display = 'flex';

            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
        }
    }

    function bindSectionRows() {
        var section_row = document.querySelectorAll('.section_row');
        section_row.forEach(function(row, index) {
            if (row.dataset.bound === '1') return;
            row.dataset.bound = '1';

            row.addEventListener('click', function(event) {
                if (isLongPress) {
                    isLongPress = false;
                    return;
                }
                if (event.button === 0 && this.dataset.id) {
                    selectRow(this, index);
                }
            });

            row.addEventListener('contextmenu', function(event) {
                event.preventDefault();
                showContextMenu(event, this, index);
            });

            row.addEventListener('touchstart', function(event) {
                isLongPress = false;
                longPressTimer = setTimeout(function() {
                    isLongPress = true;
                    showContextMenu(event, row, index);
                }, LONG_PRESS_DELAY);
            });
            row.addEventListener('touchmove', function() { clearTimeout(longPressTimer); });
            row.addEventListener('touchend', function() { clearTimeout(longPressTimer); });
            row.addEventListener('touchcancel', function() { clearTimeout(longPressTimer); });
        });
    }

    document.addEventListener('click', function(event) {
        if (contextMenu_report && !contextMenu_report.contains(event.target)) {
            contextMenu_report.style.display = 'none';
        }
    });
    document.addEventListener('touchstart', function(event) {
        if (contextMenu_report && !contextMenu_report.contains(event.target)) {
            contextMenu_report.style.display = 'none';
        }
    });

    function selectRow(row, index) {
        selectedfuelId = row.dataset.id;

        var productCodeInput = row.querySelector('.product-cod_fuel');
        var productCode = productCodeInput ? productCodeInput.value : '';

        if (row.classList.contains('active-report')) {
            row.classList.remove('active-report');
            row.querySelectorAll('input').forEach(function(input) {
                input.classList.remove('active-input');
            });
            previousfuelRow = null;
            if (remove_section) remove_section.disabled = true;
            if (link_changefuel_modal) link_changefuel_modal.disabled = true;
        } else {
            if (previousfuelRow !== null) {
                previousfuelRow.classList.remove('active-report');
                previousfuelRow.querySelectorAll('input').forEach(function(input) {
                    input.classList.remove('active-input');
                });
            }

            row.classList.add('active-report');
            row.querySelectorAll('input').forEach(function(input) {
                input.classList.add('active-input');
            });
            previousfuelRow = row;

            var canRemove = true, canEdit = true;
            if (productCode === '9010') {
                canRemove = false; canEdit = true;
            } else if (productCode === '9100' || productCode === '9001') {
                canRemove = false; canEdit = false;
            }
            if (remove_section) remove_section.disabled = !canRemove;
            if (link_changefuel_modal) link_changefuel_modal.disabled = !canEdit;
        }

        syncPodRowActions();
    }

    // --- Кнопки "Редактировать" / "Удалить" в под-меню отчёта (content-pod-menu) ---
    // Дублируют действия контекстного меню строки (contextMenu_report), но
    // вызываются из верхнего меню. Доступны только когда в таблице выбрана
    // строка (и её код продукции допускает действие); на отправленном или
    // одобренном отчёте весь блок отключён классом .functions_menu.disabled
    // (см. macros/content.html), поэтому клики до обработчиков не доходят.
    function syncPodRowActions() {
        var podEdit = document.getElementById('pod-edit-section-btn');
        var podRemove = document.getElementById('pod-remove-section-btn');
        if (!podEdit && !podRemove) return;

        var group = (podEdit || podRemove).closest('.functions_menu');
        var statusLocked = !!(group && group.classList.contains('disabled'));
        // Без выбранной строки обе кнопки неактивны (даже если статус отчёта
        // позволяет редактирование). Контекстное меню помечает свои кнопки
        // классом .disabled по статусу, но не свойством .disabled — поэтому
        // ориентируемся именно на наличие выбранной строки.
        var hasRow = !!document.querySelector('.section_row.active-report');
        var editDisabled = statusLocked || !hasRow || !link_changefuel_modal || link_changefuel_modal.disabled;
        var removeDisabled = statusLocked || !hasRow || !remove_section || remove_section.disabled;

        if (podEdit) podEdit.classList.toggle('disabled', editDisabled);
        if (podRemove) podRemove.classList.toggle('disabled', removeDisabled);
    }

    var pod_edit_section_btn = document.getElementById('pod-edit-section-btn');
    if (pod_edit_section_btn) {
        pod_edit_section_btn.addEventListener('click', function() {
            if (pod_edit_section_btn.classList.contains('disabled')) return;
            if (selectedfuelId) {
                if (contextMenu_report) contextMenu_report.style.display = 'none';
                openChangefuel_modal();
            }
        });
    }

    var pod_remove_section_btn = document.getElementById('pod-remove-section-btn');
    if (pod_remove_section_btn) {
        pod_remove_section_btn.addEventListener('click', function() {
            if (pod_remove_section_btn.classList.contains('disabled')) return;
            submitRemoveSection();
        });
    }

    // ------------------------------------------------------------------
    //  Удаление продукции (AJAX)
    // ------------------------------------------------------------------
    function submitRemoveSection() {
        var activeRow = document.querySelector('.section_row.active-report');
        if (activeRow === null) {
            alert('Выберите продукцию для удаления');
            return;
        }
        var section_id = activeRow.dataset.id;
        if (!section_id) return;
        var deleteForm = document.getElementById('remove_section_form');
        if (!deleteForm) return;
        deleteForm.action = '/remove_section/' + section_id;
        addCsrfTokenToForm(deleteForm);
        if (contextMenu_report) contextMenu_report.style.display = 'none';
        ajaxSubmit(deleteForm, refreshSectionsTable);
    }

    if (remove_section) {
        remove_section.addEventListener('click', function(event) {
            event.preventDefault();
            submitRemoveSection();
        });
    }

    // ------------------------------------------------------------------
    //  Редактирование продукции (changefuel_modal) — логика без изменений,
    //  добавлена только отправка через AJAX.
    // ------------------------------------------------------------------
    function openChangefuel_modal() {
        var activeRow = document.querySelector('.section_row.active-report');
        if (!activeRow) return;

        var productCode = activeRow.querySelector('.product-cod_fuel').value;
        var productName = activeRow.querySelector('.product-name_fuel').value;

        function replaceDotsWithCommas(value) {
            return (value || '').replace(/\./g, ',');
        }

        document.getElementById('modal_product_name').value = productName;
        document.getElementById('modal_oked').value = activeRow.querySelector('input[name="Oked_fuel"]').value;
        document.getElementById('modal_produced').value = replaceDotsWithCommas(activeRow.querySelector('input[name="produced_fuel"]').value);
        document.getElementById('modal_Consumed_Quota').value = replaceDotsWithCommas(activeRow.querySelector('input[name="Consumed_Quota_fuel"]').value);
        document.getElementById('modal_Consumed_Fact').value = replaceDotsWithCommas(activeRow.querySelector('input[name="Consumed_Fact_fuel"]').value);
        document.getElementById('modal_Consumed_Total_Quota').value = replaceDotsWithCommas(activeRow.querySelector('input[name="Consumed_Total_Quota_fuel"]').value);
        document.getElementById('modal_Consumed_Total_Fact').value = replaceDotsWithCommas(activeRow.querySelector('input[name="Consumed_Total_Fact_fuel"]').value);
        document.getElementById('modal_note').value = activeRow.querySelector('input[name="note_fuel"]').value;
        document.getElementById('modal_id').value = selectedfuelId;

        var inputs = document.querySelectorAll('#changefuel_modal input[type="text"]');
        var isOtherConsumption = productCode === "9010";
        var is7000 = productCode === "7000";

        inputs.forEach(function(input, index) {
            if (isOtherConsumption) {
                if (index < inputs.length - 2) {
                    input.style.color = "rgb(132, 132, 132)";
                    input.readOnly = true;
                } else {
                    input.style.color = "";
                    input.readOnly = false;
                }
                input.required = index >= inputs.length - 2;
            } else if (is7000) {
                if (index === 5 || index === 6 || index === 7) {
                    input.readOnly = false;
                    input.style.color = "";
                } else {
                    input.style.color = "rgb(132, 132, 132)";
                    input.readOnly = true;
                }
            } else {
                if (index === 0 || index === 1 || index === 4 || index === 5) {
                    input.style.color = "rgb(132, 132, 132)";
                    input.readOnly = true;
                } else {
                    input.style.color = "";
                    input.readOnly = false;
                }
            }
        });

        var cm = document.getElementById('changefuel_modal');
        if (cm) cm.classList.add('active');
    }

    if (link_changefuel_modal) {
        link_changefuel_modal.addEventListener('click', function() {
            if (selectedfuelId) {
                if (contextMenu_report) contextMenu_report.style.display = 'none';
                openChangefuel_modal();
            }
        });
    }

    var changeSectionForm = document.getElementById('changeSectionForm');
    if (changeSectionForm) {
        changeSectionForm.addEventListener('submit', function(e) {
            e.preventDefault();
            ajaxSubmit(changeSectionForm, function() {
                var cm = document.getElementById('changefuel_modal');
                if (cm) cm.classList.remove('active');
                return refreshSectionsTable();
            });
        });
    }

    if (document.getElementById('changefuel_modal')) {
        handleModal(document.getElementById('changefuel_modal'), document.getElementById('link_changefuel_modal'));
    }

    // ------------------------------------------------------------------
    //  Добавление продукции — поэтапная модалка (шаг 1: выбор, шаг 2: параметры)
    // ------------------------------------------------------------------
    var addSectionModal = document.getElementById('addSection_modal');
    var addSectionForm = document.getElementById('addSectionForm');
    var addStep1 = document.getElementById('addSectionStep1');
    var addStep2 = document.getElementById('addSectionStep2');
    var addNextBtn = document.getElementById('addSectionNextBtn');
    var addBackBtn = document.getElementById('addSectionBackBtn');
    var addChosen = document.getElementById('addSectionChosen');
    var chooseProdTableBody = document.getElementById('chooseProdTableBody');
    var nameOfProductInput = addSectionForm ? addSectionForm.querySelector('input[name="name_of_product"]') : null;
    var addIdProductInput = document.getElementById('add_id_product');
    var addUnitNameInput = document.getElementById('add_unit_name');
    var addProductCodeInput = document.getElementById('add_product_code');
    var addSearchInput = addSectionForm ? addSectionForm.querySelector('input[name="search_product"]') : null;

    function parseNum(v) {
        var n = parseFloat(String(v == null ? '' : v).replace(',', '.').replace(/\s/g, ''));
        return isFinite(n) ? n : 0;
    }
    function formatNum(n) {
        if (!isFinite(n)) n = 0;
        var r = Math.round(n * 100) / 100;
        return r.toFixed(2).replace('.', ',');
    }

    function isPercentUnit(unitName) {
        return unitName === '%' || unitName === '% (включая покупную)';
    }

    // Значения серых полей считаются так же, как в бэкенде
    // (website/report.py: calculate_consumed_fact / calculate_total_quota).
    function recalcAddCalculatedFields() {
        if (!addSectionForm) return;
        var code = addProductCodeInput ? addProductCodeInput.value : '';
        if (code === '7000') return; // для 7000 серые поля не пересчитываются

        var producedEl = addSectionForm.querySelector('input[name="produced_add"]');
        var quotaEl = addSectionForm.querySelector('input[name="Consumed_Quota_add"]');
        var totalFactEl = addSectionForm.querySelector('input[name="Consumed_Total_Fact_add"]');
        var factEl = addSectionForm.querySelector('input[name="Consumed_Fact_add"]');
        var totalQuotaEl = addSectionForm.querySelector('input[name="Consumed_Total_Quota_add"]');
        if (!producedEl || !quotaEl || !totalFactEl || !factEl || !totalQuotaEl) return;

        var produced = parseNum(producedEl.value);
        var quota = parseNum(quotaEl.value);
        var totalFact = parseNum(totalFactEl.value);
        var divisor = isPercentUnit(addUnitNameInput ? addUnitNameInput.value : '') ? 100 : 1000;

        factEl.value = (produced === 0) ? '0,00' : formatNum((totalFact / produced) * divisor);
        totalQuotaEl.value = (quota === 0) ? '0,00' : formatNum((produced * quota) / divisor);
    }

    // Правила активности полей шага 2 по коду продукции (перенесено из старой
    // версии report.js — поведение сохранено).
    function applyAddFieldRules(code) {
        if (!addSectionForm) return;
        var is7000 = code === '7000';
        var isZeroed = ['0020', '0021', '0024', '0025', '0026', '0027', '0030', '0031'].indexOf(code) !== -1;
        var inputs = addSectionForm.querySelectorAll('.modal_table input');

        inputs.forEach(function(input) {
            var name = input.getAttribute('name');
            if (name === 'current_version' || name === 'add_id_product' ||
                name === 'search_product' || name === 'section_number' || !name) {
                return;
            }

            var editable;
            if (is7000) {
                editable = ['oked_add', 'Consumed_Total_Quota_add', 'Consumed_Total_Fact_add', 'note_add'].indexOf(name) !== -1;
            } else if (isZeroed) {
                editable = ['produced_add', 'Consumed_Quota_add', 'Consumed_Total_Fact_add', 'note_add'].indexOf(name) !== -1;
            } else {
                editable = ['oked_add', 'produced_add', 'Consumed_Quota_add', 'Consumed_Total_Fact_add', 'note_add'].indexOf(name) !== -1;
            }

            if (editable) {
                input.readOnly = false;
                input.style.color = '';
            } else {
                input.readOnly = true;
                input.style.color = 'rgb(132, 132, 132)';
                if (name !== 'name_of_product') {
                    input.value = (name === 'oked_add') ? '' : '0,00';
                }
            }
        });

        recalcAddCalculatedFields();
    }

    function chooseProduct(tr) {
        if (!tr || !tr.dataset.id) return;
        var id = tr.dataset.id;
        var code = tr.dataset.code || (tr.cells[0] ? tr.cells[0].textContent.trim() : '');
        var unit = tr.dataset.unit || (tr.cells[2] ? tr.cells[2].textContent.trim() : '');
        var name = tr.cells[1] ? tr.cells[1].textContent.trim() : '';

        if (chooseProdTableBody) {
            chooseProdTableBody.querySelectorAll('tr.chosen-product').forEach(function(r) {
                r.classList.remove('chosen-product');
            });
        }
        tr.classList.add('chosen-product');

        if (addIdProductInput) addIdProductInput.value = id;
        if (addUnitNameInput) addUnitNameInput.value = unit;
        if (addProductCodeInput) addProductCodeInput.value = code;
        if (nameOfProductInput) {
            nameOfProductInput.value = name;
            nameOfProductInput.title = name;
        }
        if (addChosen) {
            addChosen.textContent = code + ' — ' + name;
            addChosen.classList.add('is-set');
        }
        if (addNextBtn) addNextBtn.disabled = false;
    }

    if (chooseProdTableBody) {
        chooseProdTableBody.addEventListener('click', function(event) {
            var tr = event.target.closest('tr');
            if (tr && tr.id !== 'noResultsRow') chooseProduct(tr);
        });
    }

    if (addSearchInput) {
        addSearchInput.addEventListener('input', function(e) {
            filterProducts(e.target.value);
        });
    }

    function showAddStep(step) {
        if (!addStep1 || !addStep2) return;
        addStep1.style.display = (step === 1) ? '' : 'none';
        addStep2.style.display = (step === 2) ? '' : 'none';
        var bar = document.getElementById('addSectionProgressBar');
        if (bar) bar.style.width = (step === 2) ? '100%' : '50%';
    }

    function resetAddWizard() {
        showAddStep(1);
        if (addSectionForm) addSectionForm.reset();
        if (addIdProductInput) addIdProductInput.value = '';
        if (addUnitNameInput) addUnitNameInput.value = '';
        if (addProductCodeInput) addProductCodeInput.value = '';
        if (addNextBtn) addNextBtn.disabled = true;
        if (addChosen) {
            addChosen.textContent = 'Продукция не выбрана';
            addChosen.classList.remove('is-set');
        }
        if (chooseProdTableBody) {
            chooseProdTableBody.querySelectorAll('tr.chosen-product').forEach(function(r) {
                r.classList.remove('chosen-product');
            });
        }
        if (typeof filterProducts === 'function') filterProducts('');
    }

    if (addNextBtn) {
        addNextBtn.addEventListener('click', function() {
            if (!addIdProductInput || !addIdProductInput.value) return;
            applyAddFieldRules(addProductCodeInput ? addProductCodeInput.value : '');
            showAddStep(2);
        });
    }
    if (addBackBtn) {
        addBackBtn.addEventListener('click', function() { showAddStep(1); });
    }

    // Пересчёт серых полей в реальном времени
    if (addSectionForm) {
        ['produced_add', 'Consumed_Quota_add', 'Consumed_Total_Fact_add'].forEach(function(name) {
            var el = addSectionForm.querySelector('input[name="' + name + '"]');
            if (el) el.addEventListener('input', recalcAddCalculatedFields);
        });

        addSectionForm.addEventListener('submit', function(e) {
            e.preventDefault();
            recalcAddCalculatedFields();
            ajaxSubmit(addSectionForm, function() {
                if (addSectionModal) addSectionModal.classList.remove('active');
                resetAddWizard();
                return refreshSectionsTable();
            });
        });
    }

    if (addSectionModal) {
        var addOpener = document.querySelector('[data-action="link_addSection_modal"]');
        handleModal(addSectionModal, addOpener);
        if (addOpener) {
            addOpener.addEventListener('click', function() {
                // небольшая задержка — handleModal успевает открыть модалку
                setTimeout(resetAddWizard, 0);
            });
        }
    }

    // ------------------------------------------------------------------
    //  Кнопки статуса отчёта в под-меню
    // ------------------------------------------------------------------
    if (document.getElementById('control-report-btn')) {
        document.getElementById('control-report-btn').addEventListener('click', function() {
            document.getElementById('control-report-form').submit();
        });
    }
    if (document.getElementById('agreed-report-btn')) {
        document.getElementById('agreed-report-btn').addEventListener('click', function() {
            document.getElementById('agreed-report-form').submit();
        });
    }
    if (document.getElementById('sent-report-btn')) {
        handleModal(document.getElementById('SentModal'), document.getElementById('sent-report-btn'));
    }
    if (document.getElementById('cancel-sending-btn')) {
        document.getElementById('cancel-sending-btn').addEventListener('click', function() {
            document.getElementById('cancel-sending-form').submit();
        });
    }
    if (document.getElementById('export-table-btn')) {
        document.getElementById('export-table-btn').addEventListener('click', function() {
            document.getElementById('export-table-form').submit();
        });
    }

    // ------------------------------------------------------------------
    //  Инициализация
    // ------------------------------------------------------------------
    bindSectionRows();
    syncPodRowActions();
});

// Фильтр таблицы выбора продукции (шаг 1 модалки добавления).
function filterProducts(searchText) {
    const tbody = document.getElementById('chooseProdTableBody');
    if (!tbody) return;
    const rows = tbody.querySelectorAll('tr:not(#noResultsRow)');
    const noResultsRow = document.getElementById('noResultsRow');
    let hasVisibleRows = false;

    searchText = (searchText || '').toLowerCase().trim();

    rows.forEach(row => {
        const codeCell = row.cells[0];
        const nameCell = row.cells[1];
        let shouldShow = false;
        if (codeCell && nameCell) {
            const code = codeCell.textContent.toLowerCase();
            const name = nameCell.textContent.toLowerCase();
            shouldShow = (searchText === '') || code.includes(searchText) || name.includes(searchText);
        }
        row.style.display = shouldShow ? '' : 'none';
        if (shouldShow) hasVisibleRows = true;
    });

    if (noResultsRow) {
        noResultsRow.style.display = (hasVisibleRows || searchText === '') ? 'none' : '';
    }
}

function scrollToTickets() {
    const formElement = document.getElementById('ticket-area');
    if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth' });
    }
}
