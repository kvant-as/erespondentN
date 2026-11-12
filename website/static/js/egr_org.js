// Поиск организации по УНП в ЕГР (макрос content.egr_lookup). Найденная
// организация показывается карточкой, её УНП попадает в скрытое поле формы
// [data-egr-unp], кнопка [data-egr-submit] становится активной.
(function () {
    function setText(root, name, value) {
        root.querySelectorAll('[data-egr-field="' + name + '"]').forEach(function (el) {
            el.textContent = value || '—';
        });
    }

    function init(block) {
        var form = block.closest('form');
        var input = block.querySelector('[data-egr-input]');
        var button = block.querySelector('[data-egr-search]');
        var status = block.querySelector('[data-egr-status]');
        var card = block.querySelector('[data-egr-card]');
        var note = block.querySelector('[data-egr-note]');
        var hidden = form && form.querySelector('[data-egr-unp]');
        var submit = form && form.querySelector('[data-egr-submit]');
        var defaultHint = status.textContent;
        var busy = false;

        function reset() {
            card.hidden = true;
            card.classList.remove('is-blocked');
            if (hidden) hidden.value = '';
            if (submit) submit.disabled = true;
        }

        function showStatus(text, kind) {
            status.textContent = text;
            status.classList.toggle('is-error', kind === 'error');
        }

        function valid() { return /^\d{9}$/.test(input.value); }

        input.addEventListener('input', function () {
            input.value = input.value.replace(/\D/g, '').slice(0, 9);
            button.disabled = !valid() || busy;
            reset();
            showStatus(defaultHint);
        });

        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (valid() && !busy) search();
            }
        });

        button.addEventListener('click', search);

        function search() {
            busy = true;
            button.disabled = true;
            button.classList.add('is-loading');
            reset();
            showStatus('Запрос в ЕГР…');
            fetch('/api/egr/lookup?unp=' + encodeURIComponent(input.value), {
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
                credentials: 'same-origin'
            })
                .then(function (r) { return r.json().catch(function () { return {}; }); })
                .then(function (data) {
                    if (!data.success) {
                        showStatus(data.error || 'Не удалось получить данные из ЕГР', 'error');
                        return;
                    }
                    var org = data.organization;
                    ['full_name', 'status', 'unp', 'region', 'legal_address'].forEach(function (k) { setText(card, k, org[k]); });
                    card.dataset.statusKind = org.status_kind;
                    card.hidden = false;
                    if (org.blocked) {
                        card.classList.add('is-blocked');
                        note.textContent = org.blocked;
                        showStatus('Выберите другую организацию', 'error');
                        return;
                    }
                    note.textContent = org.in_database
                        ? 'Организация уже есть в системе — её данные будут обновлены из ЕГР.'
                        : 'Организации ещё нет в системе — она будет добавлена по данным ЕГР.';
                    showStatus('Организация найдена. Проверьте данные и подтвердите выбор.');
                    if (hidden) hidden.value = org.unp;
                    if (submit) submit.disabled = false;
                })
                .catch(function () { showStatus('Нет связи с сервером — попробуйте ещё раз', 'error'); })
                .finally(function () {
                    busy = false;
                    button.classList.remove('is-loading');
                    button.disabled = !valid();
                });
        }

        if (form) {
            form.addEventListener('submit', function (e) {
                if (!hidden || !hidden.value) { e.preventDefault(); return; }
                if (submit) {
                    submit.disabled = true;
                    submit.classList.add('is-loading');
                    var label = submit.querySelector('span');
                    if (label && submit.dataset.loadingText) label.textContent = submit.dataset.loadingText;
                }
            });
        }
    }

    document.querySelectorAll('[data-egr-lookup]').forEach(init);
})();
