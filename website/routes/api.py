from datetime import timedelta
import threading
import uuid

from flask import Blueprint, current_app, flash, jsonify, redirect, send_file, request
from flask_login import current_user, login_required

from website.export import create_archive_async
from website.models import Organization
from website.sessions import session_required
from website.time import current_utc_time

from .. import db
from ..models import (
    User, Organization, Report, Version_report, DirUnit,
    DirProduct, Sections, Ticket, Message
)

from website.export import export_tasks

api = Blueprint('api', __name__)

@api.route('/organizations', methods=['GET'])
@login_required
@session_required
def get_organizations():
    page = request.args.get("page", 1, type=int)
    search_query = request.args.get("q", "", type=str)

    query = Organization.query
    if search_query:
        query = query.filter(
            db.or_(
                Organization.full_name.ilike(f"%{search_query}%"),
                Organization.okpo.ilike(f"%{search_query}%")
            )
        )

    per_page = 10
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        "organizations": [
            {
                "id": org.id,
                "full_name": org.full_name,
                "okpo": org.okpo,
                "ynp": org.ynp,
                "ministry": org.ministry,
            }
            for org in pagination.items
        ],
        "page": pagination.page,
        "has_next": pagination.has_next,
        "total_pages": pagination.pages,  
        "total_items": pagination.total 
    })
    
@api.route('/export/start', methods=['POST'])
@login_required 
@session_required
def start_export():
    try:
        export_format = request.form.get('format', '').upper()
        year_filter = request.form.get('year_filter', '')
        quarter_filter = request.form.get('quarter_filter', '')
        export_region = request.form.get('export_region', '')
        
        if export_format not in ['DBF', 'XML']:
            return jsonify({'success': False, 'error': 'Неверный формат'})
        
        task_id = str(uuid.uuid4())
        user_id = current_user.id
        
        current_user_type = current_user.type
        okpo_str = str(current_user.organization.okpo)
        okpo_digit = okpo_str[-4] if len(okpo_str) >= 4 else ''
        
        if current_user_type == "Администратор" or current_user_type == "Смотрящий":
            if export_region and export_region.isdigit():
                okpo_value = export_region
            else:
                okpo_value = '8'
        else:
            if current_user_type != "Администратор" and not (current_user_type == "Аудитор" and okpo_digit == "8"):
                okpo_value = okpo_digit
            else:
                okpo_value = '8'
        
        thread = threading.Thread(
            target=create_archive_async,
            args=(export_format, task_id, user_id, okpo_value, year_filter, quarter_filter)
        )
        thread.daemon = True
        thread.start()
        
        return jsonify({'success': True, 'task_id': task_id})
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@api.route('/export/status/<task_id>', methods=['GET'])
@login_required
def export_status(task_id):
    if task_id not in export_tasks:
        return jsonify({'success': False, 'error': 'Задача не найдена'})
    
    task = export_tasks[task_id]
    
    return jsonify({
        'success': True,
        'status': task['status'],
        'progress': task.get('progress', 0),
        'message': task.get('error', '')
    })

@api.route('/export/download/<task_id>', methods=['GET'])
@login_required
def download_export(task_id):
    if task_id not in export_tasks:
        flash('Файл не найден', 'error')
        return redirect(request.referrer)
    
    task = export_tasks[task_id]
    
    if task['status'] != 'completed':
        flash('Архив еще не готов', 'error')
        return redirect(request.referrer)
    
    file_path = task['file_path']
    export_format = task.get('format', 'reports')
    
    if export_format == 'DBF':
        download_name = f'reports_DBF_{task_id[:8]}.zip'
    else:
        download_name = f'reports_XML_{task_id[:8]}.zip'
    
    return send_file(
        file_path,
        as_attachment=True,
        download_name=download_name,
        mimetype='application/zip'
    )
    
# @api.route('/online-count', methods=['GET'])
# def api_online_count():
#     try:
#         five_minutes_ago = current_utc_time() - timedelta(minutes=5)
#         count = User.query.filter(User.last_active >= five_minutes_ago).count()
#         return jsonify({
#             'success': True,
#             'count': count
#         })
#     except Exception as e:
#         current_app.logger.error(f"Error in online count API: {e}")
#         return jsonify({
#             'success': False,
#             'count': 0
#         }), 500

@api.route('/messages', methods=['GET'])
@login_required
def get_messages_api():
    try:
        if current_user.type == "Администратор":
            messages = Message.query.filter(
                (Message.to_admin == True) | (Message.recipient_id == current_user.id)
            ).order_by(Message.id.desc()).all()
        else:
            messages = Message.query.filter_by(recipient_id=current_user.id).order_by(Message.id.desc()).all()
        
        messages_data = []
        for msg in messages:
            can_reply = False
            if current_user.type == "Администратор" and msg.sender_id != current_user.id and msg.sender_id is not None:
                can_reply = True
            elif current_user.type != "Администратор" and msg.sender_id == current_user.id and msg.recipient_id is not None:
                can_reply = True
            
            sender_info = {}
            if msg.sender:
                sender_info = {
                    'email': msg.sender.email,
                    'fio': msg.sender.fio,
                    'telephone': msg.sender.telephone,
                    'type': msg.sender.type
                }
            
            messages_data.append({
                'id': msg.id,
                'create_time': msg.create_time.strftime('%d.%m.%Y %H:%M'),
                'text': msg.text,
                'sender_id': msg.sender_id,
                'sender': sender_info,
                'recipient_id': msg.recipient_id,
                'is_read': msg.is_read,
                'read_time': msg.read_time.strftime('%d.%m.%Y %H:%M') if msg.read_time else None,
                'to_admin': msg.to_admin,
                'can_reply': can_reply
            })
        
        return jsonify({
            'success': True,
            'messages': messages_data,
            'count': len(messages_data)
        })
        
    except Exception as e:
        current_app.logger.error(f"Ошибка при получении сообщений: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Ошибка при загрузке сообщений'
        }), 500
        
@api.route('/mark_all_read', methods=['POST'])
@login_required
def mark_all_read_api():
    try:
        unread_messages = Message.query.filter_by(
            recipient_id=current_user.id,
            is_read=False
        ).all()
        
        count = len(unread_messages)
        
        for msg in unread_messages:
            msg.is_read = True
            msg.read_time = current_utc_time()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Все сообщения отмечены как прочитанные.',
            'count': count
        })
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Ошибка при отметке сообщений как прочитанных: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Ошибка при отметке сообщений как прочитанных'
        }), 500
        
@api.route('/mark_read/<int:message_id>', methods=['POST'])
@login_required
def mark_read_api(message_id):
    try:
        if current_user.type != "Администратор":
            return jsonify({
                'success': False,
                'error': 'Только администратор может отмечать сообщения как прочитанные'
            }), 403
        
        msg = Message.query.get_or_404(message_id)
        
        msg.is_read = True
        msg.read_time = current_utc_time()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Сообщение отмечено как прочитанное'
        })
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Ошибка при отметке сообщения как прочитанного: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Ошибка при отметке сообщения как прочитанного'
        }), 500