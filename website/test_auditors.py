"""Тестовые аккаунты проверяющих — по одному на каждое региональное
управление по надзору.

Почта auditor.r<номер региона>@test.local (если в регионе несколько
управлений — auditor.r<номер>-<id организации>@test.local), пароль
TEST_PASSWORD. Уже существующие аккаунты не меняются, поэтому создание
можно запускать повторно.
"""

from werkzeug.security import generate_password_hash

from common_models import get_current_application_id
from . import db
from .models import Organization, User

TEST_PASSWORD = 'Test12345!'
TEST_DOMAIN = 'test.local'


def _email_for(org, taken_regions):
    number = org.region.number if org.region else None
    if number is None:
        return f'auditor.org{org.id}@{TEST_DOMAIN}'
    if number in taken_regions:
        return f'auditor.r{number}-{org.id}@{TEST_DOMAIN}'
    taken_regions.add(number)
    return f'auditor.r{number}@{TEST_DOMAIN}'


def ensure_test_auditors():
    """Создаёт недостающие тестовые аккаунты. Возвращает список
    (email, название управления, создан ли сейчас)."""
    app_id = get_current_application_id()
    orgs = (Organization.query
            .filter(Organization.is_region_management == True)
            .order_by(Organization.region_id, Organization.id)
            .all())
    taken_regions = set()
    result = []
    for org in orgs:
        email = _email_for(org, taken_regions)
        user = User.query.filter_by(email=email, application_id=app_id).first()
        created = user is None
        if created:
            region = org.region.name if org.region else 'без региона'
            number = org.region.number if org.region else 0
            user = User(
                email=email,
                password=generate_password_hash(TEST_PASSWORD),
                application_id=app_id,
                is_verified=True,
                last_name='Аудитор',
                first_name='Тестовый',
                patronymic_name=None,
                telephone=f'+37529000000{number}',
                post=f'Тестовый проверяющий — {region}',
                organization_id=org.id,
            )
            db.session.add(user)
        result.append((email, org.full_name, created))
    db.session.commit()
    return result
