"""Номера телефона пользователя — те же правила, что в enPlans (website/user.py):
один номер в международном формате +375, ровно 12 цифр вместе с кодом.
В базе хранится строкой вида +375291234567."""
import re

PHONE_PREFIX = '+375'
PHONE_TOTAL_DIGITS = 12
PHONE_MAX_COUNT = 1


def parse_and_validate_phones(raw_telephone):
    """Возвращает (строка_для_сохранения, None) или (None, текст_ошибки)."""
    if not raw_telephone or not str(raw_telephone).strip():
        return None, 'Поле «Номер телефона» обязательно для заполнения'

    raw_numbers = [n.strip() for n in re.split(r'[;,]', str(raw_telephone)) if n.strip()]
    if not raw_numbers:
        return None, 'Поле «Номер телефона» обязательно для заполнения'
    if len(raw_numbers) > PHONE_MAX_COUNT:
        return None, 'Можно указать только один номер телефона'

    validated = []
    for number in raw_numbers:
        if not number.startswith(PHONE_PREFIX):
            return None, f'Номер телефона «{number}» должен начинаться с {PHONE_PREFIX}'
        if len(re.sub(r'\D', '', number)) != PHONE_TOTAL_DIGITS:
            return None, f'Номер телефона «{number}» должен содержать {PHONE_TOTAL_DIGITS} цифр вместе с кодом'
        validated.append(number)
    return '; '.join(validated), None
