"""Организация пользователя по данным ЕГР (common_models.egr).

Используется при регистрации (шаг «Организация»), при смене организации и
при обновлении её данных из профиля. Организация ищется в базе по УНП: если
она уже есть — её данные обновляются из ЕГР, если нет — добавляется целиком.
"""
from common_models import current_utc_time, db
from common_models.egr import (
    INACTIVE_KINDS, STATUS_LABELS, EgrError, apply_to_organization, fetch_organization, normalize_unp,
)
from common_models.models import Organization, Region

__all__ = ['EgrError', 'lookup', 'find_by_unp', 'upsert_from_egr', 'refresh_from_egr', 'inactive_error']


def find_by_unp(unp):
    """Организация с этим УНП в базе. Если записей несколько (исторические
    дубли) — берётся действующая с самым маленьким id."""
    return (Organization.query
            .filter(Organization.ynp == unp)
            .order_by(Organization.is_active.desc().nullslast(), Organization.id)
            .first())


def _region_name(number):
    if not number:
        return None
    region = Region.query.filter_by(number=number).first()
    return region.name if region else None


def inactive_error(data):
    kind = data.get('status_kind')
    if kind in INACTIVE_KINDS:
        label = STATUS_LABELS.get(kind, data.get('status') or '').lower()
        return f'По данным ЕГР организация {label} — зарегистрироваться от её имени нельзя'
    return None


def lookup(unp):
    """Данные ЕГР для показа пользователю перед выбором организации."""
    unp = normalize_unp(unp)
    data = fetch_organization(unp)
    existing = find_by_unp(unp)
    return {
        'unp': unp,
        'full_name': data.get('full_name'),
        'short_name': data.get('short_name'),
        'legal_address': data.get('legal_address'),
        'region': _region_name(data.get('region_number')),
        'status': STATUS_LABELS.get(data.get('status_kind') or 'unknown'),
        'status_kind': data.get('status_kind') or 'unknown',
        'in_database': bool(existing),
        'blocked': inactive_error(data),
    }


def upsert_from_egr(unp):
    """Организация по УНП с актуальными данными ЕГР: существующая — обновлена,
    новая — создана. Коммит — на вызывающем. EgrError — если ЕГР недоступен,
    организация не найдена или не действующая."""
    unp = normalize_unp(unp)
    data = fetch_organization(unp)
    blocked = inactive_error(data)
    if blocked:
        raise EgrError(blocked)
    if not data.get('full_name'):
        raise EgrError(f'В ЕГР нет наименования организации с УНП {unp}')

    org = find_by_unp(unp)
    created = org is None
    if created:
        org = Organization(ynp=unp, is_active=True, created_at=current_utc_time())
        db.session.add(org)
    apply_to_organization(org, data)
    return org, created


def refresh_from_egr(org):
    """Обновление уже привязанной организации — список изменений [(поле, было, стало)]."""
    if not org or not org.ynp:
        raise EgrError('У организации не указан УНП — обновить данные из ЕГР нельзя')
    data = fetch_organization(org.ynp)
    return apply_to_organization(org, data)
