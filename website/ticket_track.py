"""Строки таблицы квитанций отчёта — один источник и для таблицы на
странице (macros/content.html, tickets_track), и для печати квитанций в PDF.

Порядок: квитанции по времени. Служебные квитанции (отправка, отмена
отправки, внесение изменений) пишутся фиксированными фразами из report.py;
«Решение проверки» — квитанция проверяющего, её статус в текущем круге
проверки берётся из статуса отчёта. Круг проверки начинается с последней
отправки (version.sent_time).
"""

from .models import Organization
from .report import APPROVED_NOTE, ROLLBACK_NOTE, CANCEL_NOTE, CHANGE_NOTE, SENT_NOTE

DATE_FMT = '%d.%m.%Y %H:%M'


def review_org_for(report):
    """Региональное управление по надзору, которое проверяет отчёт."""
    org = report.organization if report else None
    if not org or not org.region_id:
        return None
    return Organization.query.filter(
        Organization.region_id == org.region_id,
        Organization.is_region_management == True
    ).first()


def person_of(user):
    if not user:
        return ''
    name = ' '.join(p for p in (user.last_name, user.first_name, user.patronymic_name) if p)
    return ', '.join(p for p in (name, user.telephone) if p)


def track_rows(version, tickets=None):
    """Список строк: kind, type_label, org, org_name, person, badge_cls,
    badge_label, date (datetime или None), note."""
    report = version.report
    org = report.organization if report else None
    org_name = org.full_name if org else '—'
    author_person = person_of(report.user if report else None)
    review_org = review_org_for(report)
    if review_org:
        review_org_name = review_org.short_name or review_org.full_name.split(' по надзору')[0]
    else:
        review_org_name = 'Региональное управление по надзору'

    tickets = sorted(tickets if tickets is not None else (version.tickets or []), key=lambda t: t.id)
    last_change = None
    for t in tickets:
        if t.note == CHANGE_NOTE:
            last_change = t

    sent = version.sent_time
    older, cycle = [], []
    for t in tickets:
        (cycle if sent and t.begin_time and t.begin_time >= sent else older).append(t)

    current = None
    for t in cycle:
        if t.note == CANCEL_NOTE:
            current = None
        elif t.note not in (CHANGE_NOTE, SENT_NOTE):
            current = t

    rows = []

    def row(kind, type_label, o, o_name, person, badge_cls, badge_label, date, note):
        rows.append({'kind': kind, 'type_label': type_label, 'org': o, 'org_name': o_name,
                     'person': person or '', 'badge_cls': badge_cls, 'badge_label': badge_label,
                     'date': date, 'note': note or ''})

    def org_row(kind, type_label, t, badge_label, date, note=''):
        row(kind, type_label, org, org_name, person_of(t.user) if t else author_person or '',
            'status-draft', badge_label, date, note)
        if t and not rows[-1]['person']:
            rows[-1]['person'] = author_person

    def review_row(kind, badge_cls, badge_label, t, date, note):
        row(kind, 'Решение проверки', review_org, review_org_name, person_of(t.user) if t else '',
            badge_cls, badge_label, date, note)

    def past(t):
        note = (t.note or '').strip()
        if note == CANCEL_NOTE:
            org_row('cancel', 'Отмена отправки', t, 'Заполнение', t.begin_time)
        elif note == CHANGE_NOTE:
            first, last = t.begin_time, (version.change_time if t is last_change else None)
            later = last and first and (last - first).total_seconds() >= 60
            org_row('change', 'Внесение изменений', t, 'Заполнение', first,
                    f'Последнее изменение: {last.strftime(DATE_FMT)}' if later else '')
        elif note == SENT_NOTE:
            org_row('sent', 'Направление на проверку', t, 'Отправлен', t.begin_time)
        elif t.luck or note == APPROVED_NOTE:
            review_row('done', 'status-approved', 'Одобрен', t, t.begin_time, note)
        elif note == ROLLBACK_NOTE:
            review_row('neutral', 'status-draft', 'Возвращён на рассмотрение', t, t.begin_time, note)
        else:
            review_row('warning', 'status-warning', 'Есть замечания', t, t.begin_time, note)

    def current_row(t):
        note = (t.note or '').strip()
        if note == ROLLBACK_NOTE:
            note = ''
        status, audit, created = version.status, version.audit_time, t.begin_time
        if t.luck or status == 'Одобрен':
            review_row('done', 'status-approved', 'Одобрен', t, audit or created, note)
        elif status == 'Отправлен':
            review_row('active', 'status-pending', 'На рассмотрении', t, created, note)
        elif status == 'Готов к удалению':
            review_row('rejected', 'status-delete', 'Готов к удалению', t, audit or created,
                       note or 'Отчёт нельзя исправить, создайте новый')
        else:
            review_row('warning', 'status-warning', 'Есть замечания', t, audit or created,
                       note or 'Исправьте отчёт и отправьте его повторно')

    for t in older:
        past(t)

    # Отправки до появления квитанций SENT_NOTE: строка по дате последней отправки.
    if sent and not any(t.note == SENT_NOTE for t in cycle):
        org_row('sent', 'Направление на проверку', None, 'Отправлен', sent)

    for t in cycle:
        current_row(t) if t is current else past(t)

    if current is None:
        status, audit = version.status, version.audit_time
        if status == 'Отправлен':
            review_row('active', 'status-pending', 'На рассмотрении', None, None, '')
        elif status == 'Есть замечания':
            review_row('warning', 'status-warning', 'Есть замечания', None, audit,
                       'Исправьте отчёт и отправьте его повторно')
        elif status == 'Готов к удалению':
            review_row('rejected', 'status-delete', 'Готов к удалению', None, audit,
                       'Отчёт нельзя исправить, создайте новый')
        elif status == 'Одобрен':
            review_row('done', 'status-approved', 'Одобрен', None, audit, '')
    return rows
