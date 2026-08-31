"""App-specific email helpers.

The send queue / SMTP engine lives in :mod:`common_models.mailer`; this module
only knows ErespondentN subjects and HTML.
"""

from common_models.mailer import get_email_queue, get_email_stats, safe_email_log
from common_models.logs import get_logger

from .email_html import build_html

log = get_logger()

SUBJECTS = {
    "code": "Код подтверждения ErespondentN",
    "new_pass": "Новый пароль ErespondentN",
    "registration": "Добро пожаловать в ErespondentN",
    "notification": "Уведомление от ErespondentN",
}


def send_email(message, recipient_email, email_type="notification"):
    html = build_html(message, email_type)
    subject = SUBJECTS.get(email_type)

    get_email_queue().add(
        to_email=recipient_email,
        subject=subject,
        html=html,
        email_type=email_type,
    )
    log.info(f"[SEND] В очередь -> {safe_email_log(recipient_email)} ({email_type})")


__all__ = ["send_email", "get_email_stats"]
