"""Переписка администратора с пользователями (Message.to_admin=True) —
перенесена сюда, в кастомную админ-панель, с общей страницы /profile (см.
static/js/messages.js), где раньше администратор видел плоский поток всех
обращений вперемешку со своими личными уведомлениями и отвечал через
встроенную туда форму (routes/views.py: reply_to_message). Список открытых
диалогов — на главной странице админки (см. admin.py: _admin_message_rows),
здесь — сама переписка с конкретным пользователем и форма ответа.

Message — плоская таблица без chat_id, поэтому "диалог" с пользователем
собирается фильтром по обеим ролям: его вопросы (sender_id=user, to_admin)
и ответы администратора ему (recipient_id=user, sender_id — какой-то админ);
автоматические системные уведомления (смена статуса отчёта и т.п., у них
sender_id пуст) в этот диалог не попадают — это не переписка с админом.
"""
from flask import Blueprint, abort, current_app, flash, jsonify, redirect, render_template, request, url_for
from flask_login import current_user, login_required

from common_models import current_utc_time, db

from ..email import send_email
from ..models import Message, User

admin_messages_bp = Blueprint('admin_messages', __name__, url_prefix='/admin/messages')


@admin_messages_bp.before_request
def _guard():
    if not current_user.is_authenticated or not current_user.is_admin:
        abort(403)


def _is_ajax():
    return request.headers.get('X-Requested-With') == 'XMLHttpRequest'


def _thread_query(user_id):
    return Message.query.filter(
        db.or_(
            db.and_(Message.sender_id == user_id, Message.to_admin.is_(True)),
            db.and_(Message.recipient_id == user_id, Message.sender_id.isnot(None)),
        )
    )


@admin_messages_bp.route('/<int:user_id>', methods=['GET', 'POST'])
@login_required
def thread(user_id):
    target_user = User.query.get_or_404(user_id)

    if request.method == 'POST':
        content = (request.form.get('content') or '').strip()
        if not content:
            if _is_ajax():
                return jsonify({'success': False, 'error': 'Введите текст ответа'}), 400
            flash('Введите текст ответа', 'error')
            return redirect(url_for('admin_messages.thread', user_id=user_id))

        reply = Message(
            sender_id=current_user.id,
            recipient_id=target_user.id,
            text=content,
            create_time=current_utc_time(),
        )
        db.session.add(reply)
        db.session.commit()

        try:
            send_email(content, target_user.email, 'notification')
        except Exception as e:
            current_app.logger.error(f"Ошибка отправки email: {e}")

        # Ответ отправляется через fetch (см. скрипт в шаблоне) — обновляем
        # переписку сразу, без перезагрузки страницы; обычный POST остаётся
        # как запасной вариант, если JS по какой-то причине недоступен.
        if _is_ajax():
            return jsonify({
                'success': True,
                'message': {
                    'id': reply.id,
                    'content': reply.text,
                    'is_user': False,
                    'created_at': reply.create_time.isoformat() if reply.create_time else None,
                },
            })
        return redirect(url_for('admin_messages.thread', user_id=user_id))

    messages = _thread_query(user_id).order_by(Message.create_time.asc()).all()
    if not messages:
        abort(404)

    unread = [m for m in messages if m.sender_id == user_id and m.to_admin and not m.is_read]
    if unread:
        for m in unread:
            m.is_read = True
            m.read_time = current_utc_time()
        db.session.commit()

    from ..admin import site  # noqa: E402  (ленивый импорт — не тянуть admin.py на старте)
    return render_template(
        'admin/message_thread.html',
        target_user=target_user, messages=messages, author_name=_author_name(target_user),
        **site.nav_context(),
    )


@admin_messages_bp.route('/<int:user_id>/messages', methods=['GET'])
@login_required
def api_messages(user_id):
    """JSON для реал-тайм-поллинга на странице переписки — тот же формат
    полей (content/is_user/created_at), что у чата виртуального помощника
    в enPlans, чтобы переиспользовать тот же клиентский приём."""
    User.query.get_or_404(user_id)
    messages = _thread_query(user_id).order_by(Message.create_time.asc()).all()
    return jsonify([{
        'id': m.id,
        'content': m.text,
        'is_user': m.sender_id == user_id,
        'created_at': m.create_time.isoformat() if m.create_time else None,
    } for m in messages])


def _author_name(user):
    full = ' '.join(filter(None, [user.last_name, user.first_name])).strip()
    return user.fio or full or user.email or f'Пользователь №{user.id}'
