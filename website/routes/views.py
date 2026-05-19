from flask import Blueprint, current_app, render_template, redirect, url_for, flash, request, jsonify, session
from flask_login import current_user, login_required

from website.report import get_reports_by_status
from ..email import send_email
from website.sessions import session_required
from ..models import User, Organization, Report, Version_report, Ticket, DirUnit, DirProduct, Sections, Message, News
from .. import db
from sqlalchemy import asc, case, desc
from functools import wraps

from datetime import datetime, timedelta
from ..time import current_utc_time, get_previous_quarter, get_report_year

views = Blueprint('views', __name__)

@views.context_processor
def inject_online_users():
    def get_online_count():
        try:
            five_minutes_ago = current_utc_time() - timedelta(minutes=5)
            return User.query.filter(User.last_active >= five_minutes_ago).count()
        except:
            return 0
    
    return dict(online_users_count=get_online_count())

def owner_only(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        version_id = kwargs.get('id')
        version = Version_report.query.get(version_id)
        if version is None:
            flash('Версия отчета не найдена.', 'error')
            return redirect(url_for('views.report_area', user=current_user))
        report = version.report
        if report.user_id != current_user.id and current_user.type != 'Администратор' and current_user.type != 'Аудитор':
            flash('Недостаточно прав для доступа к этому отчёту.', 'error')
            return redirect(url_for('views.report_area', user=current_user))
        return f(*args, **kwargs)
    return decorated_function

def profile_complete(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            flash('Требуется авторизация.', 'error')
            return redirect(url_for('views.login'))  
          
        if not current_user.fio or not current_user.telephone or not current_user.organization_id:
            flash('Пожалуйста, заполните полностью свой профиль.', 'error')
            return redirect(url_for('views.profile_common'))
        
        return f(*args, **kwargs)
    
    return decorated_function

def auditors_only(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if current_user.type not in ['Аудитор', 'Администратор', 'Смотрящий' ]:
            flash('У вас нет прав доступа', 'error')
            return redirect(url_for('views.profile_common'))
        if not current_user.fio or not current_user.telephone:
            flash('Пожалуйста, заполните ФИО и номер телефона в профиле', 'error')
            return redirect(url_for('views.profile_common'))
        return f(*args, **kwargs)
    return decorated_function

def respondent_only(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if current_user.type not in ['Респондент', 'Администратор' ]:
            flash('У вас нет прав доступа', 'error')
            return redirect(url_for('views.profile_common'))
        if not current_user.fio or not current_user.telephone:
            flash('Пожалуйста, заполните ФИО и номер телефона в профиле', 'error')
            return redirect(url_for('views.profile_common'))
        return f(*args, **kwargs)
    return decorated_function

def get_online_users_count():
    try:
        five_minutes_ago = current_utc_time() - timedelta(minutes=5)
        count = User.query.filter(User.last_active >= five_minutes_ago).count()
        return count
    except Exception as e:
        current_app.logger.error(f"Error counting online users: {e}")
        return 0
    
@views.route('/', methods=['GET'])
def beginPage():
    user_data = User.query.filter_by(type="Респондент").count()
    organization_data = Organization.query.count()
    report_data = Report.query.count()
    latest_news = News.query.order_by(desc(News.id)).first()
    return render_template('begin_page.html', 
                           latest_news=latest_news,
                           user=current_user, 
                           user_data = user_data, 
                           organization_data = organization_data, 
                           report_data = report_data,
                           previous_quarter = get_previous_quarter(),
                           previous_year=get_report_year()
                           )

@views.route('/sign', methods=['GET'])
def sign():
    return render_template('sign.html', 
                           user=current_user
                           )

@views.route('/login', methods=['GET'])
def login():
    return render_template('login.html', user=current_user
            )

@views.route('/forgot-password', methods=['GET'])
def forgot_password():
    return render_template('forgot-password.html', user=current_user
            )


@views.route('/code', methods=['GET'])
def code():
    return render_template('code.html', user=current_user
            )
    
@views.route('/test', methods=['GET'])
def test():
    return render_template('test.html', user=current_user
            )

@views.route('/profile', methods=['GET'])
@login_required
@session_required
def profile():
    return render_template('profile.html', 
                           previous_quarter = get_previous_quarter(),
                           previous_year=get_report_year(),
                           current_user=current_user, 
                           accwelcomeModal = True)

@views.route('/api/messages', methods=['GET'])
@login_required
def get_messages_api():
    try:
        messages = Message.query.filter_by(recipient_id=current_user.id).order_by(Message.id.desc()).all()
        
        messages_data = []
        for msg in messages:
            messages_data.append({
                'id': msg.id,
                'create_time': msg.create_time.strftime('%d.%m.%Y %H:%M'),
                'text': msg.text,
                'sender_id': msg.sender_id,
                'sender_email': msg.sender.email if msg.sender else None,
                'sender_type': msg.sender.type if msg.sender else None,
                'can_reply': current_user.type == "Администратор" and msg.sender_id != current_user.id and msg.sender_id is not None
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


@views.route('/delete_message/<int:message_id>', methods=['DELETE'])
@login_required
def delete_message(message_id):
    try:
        message = Message.query.filter_by(
            id=message_id, 
            recipient_id=current_user.id
        ).first()
        
        if not message:
            return jsonify({
                'success': False, 
                'error': 'Сообщение не найдено или у вас нет прав на его удаление'
            }), 404
        
        db.session.delete(message)
        db.session.commit()
        
        remaining_messages = Message.query.filter_by(
            recipient_id=current_user.id
        ).order_by(Message.id.desc()).all()
        
        return jsonify({
            'success': True, 
            'message': 'Сообщение удалено',
            'remaining_count': len(remaining_messages)
        })
            
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Ошибка при удалении сообщения: {str(e)}")
        return jsonify({'success': False, 'error': 'Внутренняя ошибка сервера'}), 500

@views.route('/delete_all_message', methods=['POST'])
@login_required
def delete_all_message():
    try:
        messages = Message.query.filter_by(
            recipient_id=current_user.id
        ).all()
        
        if not messages:
            flash('Нет сообщений для удаления.', 'error')
            return redirect(url_for('views.profile'))
        
        for message in messages:
            db.session.delete(message)
        
        db.session.commit()
        flash('Все сообщения успешно удалены.', 'success')
        current_app.logger.error("Все сообщения удалены")
            
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Ошибка при удалении сообщений: {str(e)}")
        flash('Ошибка при удалении сообщений', 'error')
        
    return redirect(url_for('views.profile'))

@views.route('/get_messages_count')
@login_required
def get_messages_count():
    count = Message.query.filter_by(recipient_id=current_user.id).count()
    return jsonify({'count': count})

@views.route('/reply_to_message/<int:message_id>', methods=['POST'])
@login_required
def reply_to_message(message_id):
    try:
        if current_user.type != "Администратор":
            return jsonify({
                'success': False, 
                'error': 'Только администраторы могут отвечать на сообщения'
            }), 403
        
        original_message = Message.query.get_or_404(message_id)
        
        if original_message.sender_id == current_user.id:
            return jsonify({
                'success': False, 
                'error': 'Нельзя отвечать на собственное сообщение'
            }), 400
        
        data = request.get_json()
        reply_text = data.get('text', '').strip()
        
        if not reply_text:
            return jsonify({
                'success': False, 
                'error': 'Текст ответа не может быть пустым'
            }), 400
        
        recipient_id = None
        
        if original_message.sender_id:
            recipient = User.query.get(original_message.sender_id)
        elif original_message.recipient_id and original_message.recipient_id != current_user.id:
            recipient = User.query.get(original_message.recipient_id)
        
        if not recipient:
            return jsonify({
                'success': False, 
                'error': 'Не удалось определить получателя ответа'
            }), 400
        
        reply_message = Message(
            sender_id=current_user.id,
            recipient_id=recipient.id,
            text=reply_text
        )
        
        db.session.add(reply_message)
        db.session.commit()
        
        # try:
        #     send_email(reply_text, recipient.email, 'just_notif')
        # except Exception as e:
        #     views.logger.error(f"Ошибка отправки email: {str(e)}")
        
        return jsonify({
            'success': True,
            'message': 'Ответ успешно отправлен',
            'refresh': False
        })
        
    except Exception as e:
        db.session.rollback()
        views.logger.error(f'Error replying to message: {str(e)}')
        return jsonify({
            'success': False, 
            'error': 'Произошла ошибка при отправке ответа'
        }), 500

@views.route('/profile/common', methods=['GET'])
@login_required
@session_required
def profile_common():
    count_reports = Report.query.filter_by(user_id=current_user.id).count()
    return render_template('profile_common.html', 
                        user=current_user, 
                        count_reports=count_reports,
                        active_tab = 'common'
                        )

@views.route('/profile/session', methods=['GET'])
@login_required
@session_required
def profile_session():
    # current_token = request.cookies.get('session_token')
    # sessions = UserSession.query.filter_by(user_id=current_user.id).all()

    # current_session = None
    # other_sessions = []

    # for sess in sessions:
    #     if sess.session_token == current_token:
    #         current_session = sess
    #     else:
    #         other_sessions.append(sess)

    return render_template(
        'profile_session.html',
        # current_session=current_session,
        # other_sessions=other_sessions,
                        active_tab = 'session'
    )

@views.route('/api/organizations', methods=['GET'])
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

@views.route('/profile/password', methods=['GET'])
@login_required
@session_required
def profile_password():
    return render_template('profile_password.html', 
                    user=current_user, 
                    active_tab  = 'pass')

@views.route('/report-area', methods=['GET'])
@profile_complete
@login_required
@respondent_only
@session_required
def report_area():
    report = Report.query.filter_by(user_id=current_user.id).order_by(
        Report.year.desc(), 
        Report.quarter.desc()
    ).all()
    version = Version_report.query.all()

    for rep in report:
        rep.versions = Version_report.query.filter_by(report_id=rep.id).all()
        for version in rep.versions:
            version.tickets = Ticket.query.filter_by(version_report_id=version.id).all()

    organization = Organization.query.filter_by(id=current_user.organization.id).first()
    
    return render_template('report_area.html',
                           previous_quarter = get_previous_quarter(),
                           previous_year=get_report_year(),
                           report=report,
                           user=current_user,
                           organization=organization,
                           version=version,
                           SentModal = True,
                           reportAreaInfoModal = True
                           )

def get_auditor_info_by_user(current_user):
    if not current_user.organization or not current_user.organization.okpo:
        return None
    okpo_str = str(current_user.organization.okpo)
    
    if len(okpo_str) < 4:
        return None
    
    fourth_digit = okpo_str[-4]
    
    auditor_okpo = fourth_digit + '000'
    
    auditor_org = Organization.query.filter_by(okpo=auditor_okpo).first()
    
    if not auditor_org:
        return None
    
    auditor = User.query.filter(
        User.type == 'Аудитор',
        User.organization_id == auditor_org.id
    ).first()
    
    if not auditor:
        return None
    
    return {
        'fio': auditor.fio or 'Не указано',
        # 'telephone': auditor.telephone or 'Не указан',
        'organization': auditor_org.full_name or 'Не указано',
    }

@views.route('/report-area/<string:report_type>/<int:id>', methods=['GET'])
@profile_complete
@login_required
@session_required
@owner_only
@respondent_only
def report_section(report_type, id):
    current_version = Version_report.query.filter_by(id=id).first()
    current_report = Report.query.filter_by(id=current_version.report_id).first()
    
    auditor_info = get_auditor_info_by_user(current_user)
    
    report_config = {
        'fuel': {'section_number': 1, 'product_filter': DirProduct.IsFuel},
        'heat': {'section_number': 2, 'product_filter': DirProduct.IsHeat},
        'electro': {'section_number': 3, 'product_filter': DirProduct.IsElectro},
    }

    if report_type not in report_config:
        return render_template('404.html')

    config = report_config[report_type]
    section_number = config['section_number']
    product_filter = config['product_filter']

    dirProduct = DirProduct.query.filter(
        product_filter == True,
        ~DirProduct.CodeProduct.in_(['9001', '9010', '9100']),
        DirProduct.DateEnd.is_(None)
    ).order_by(asc(DirProduct.CodeProduct)).all()

    sections = Sections.query.filter_by(
        id_version=current_version.id, 
        section_number=section_number
    ).order_by(
        case(
            (Sections.code_product.in_(['9001', '9010', '9100']), 1),
            else_=0
        ).asc(),
        desc(Sections.id)
    ).all()
    return render_template('report_table.html', 
        id_report = id,
        section_number=section_number,
        sections=sections,              
        dirProduct=dirProduct,
        current_user=current_user, 
        current_report=current_report,
        current_version=current_version,
        SentModal = True,
        reportAreaReportInfoModal = True,
        auditor_info=auditor_info,
        report_type=report_type
    )

@views.route('/report-area/tickets/<int:id>', methods=['GET'])
@profile_complete
@login_required
@session_required
@owner_only
@respondent_only
def report_info(id):
    current_version = Version_report.query.filter_by(id=id).first()
    current_report = Report.query.filter_by(id=current_version.report_id).first()
    
    auditor_info = get_auditor_info_by_user(current_user)
    
    return render_template('report_tickets.html', 
        current_user=current_user, 
        current_report=current_report,
        current_version=current_version,
        SentModal = True,
        reportAreaReportInfoModal = True,
        auditor_info=auditor_info,
    )


@views.route('/audit-area/<status>', methods=['GET'])
@login_required
@profile_complete
@session_required
@auditors_only
def audit_area(status):
    year_filter = request.args.get('year', '')
    quarter_filter = request.args.get('quarter', '')
    
    return render_template('audit_area.html',
                           current_user=current_user,
                           year_filter=year_filter,
                           quarter_filter=quarter_filter,
                           previous_quarter=get_previous_quarter(),
                           previous_year=get_report_year(),
                           status_reports=status,
                           auditAreaInfoModal=True)

@views.route('/api/audit-data', methods=['GET'])
@login_required
@profile_complete
@session_required
@auditors_only
def api_audit_data():
    status = request.args.get('status', 'all_reports')
    year_filter = request.args.get('year')
    quarter_filter = request.args.get('quarter')
    search_name = request.args.get('search_name')
    search_okpo = request.args.get('search_okpo')
    region_filter = request.args.get('region')
    
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    
    reports = get_reports_by_status(status, year_filter, quarter_filter, region_filter)
    
    if search_name or search_okpo:
        filtered_reports = []
        for report in reports:
            match_name = True
            match_okpo = True
            
            if search_name:
                match_name = search_name.lower() in report.organization.full_name.lower()
            if search_okpo:
                match_okpo = search_okpo in str(report.organization.okpo)
                
            if match_name and match_okpo:
                filtered_reports.append(report)
        reports = filtered_reports
    
    total_count = len(reports)
    start = (page - 1) * per_page
    end = start + per_page
    paginated_reports = reports[start:end]
    
    reports_data = []
    for row in paginated_reports:
        for version in row.versions:
            reports_data.append({
                'id': row.id,
                'version_id': version.id,
                'organization_name': row.organization.full_name,
                'okpo': row.organization.okpo,
                'year': row.year,
                'quarter': row.quarter,
                'sent_time': version.sent_time.strftime('%Y-%m-%d') if version.sent_time else '',
                'sent_datetime': version.sent_time.strftime('%Y-%m-%d %H:%M:%S') if version.sent_time else '',
                'status': version.status,
                'has_not': version.hasNot if hasattr(version, 'hasNot') else False
            })

    stats = {
        'not_viewed': len(get_reports_by_status('not_viewed', year_filter, quarter_filter, region_filter)),
        'to_delete': len(get_reports_by_status('to_delete', year_filter, quarter_filter, region_filter)),
        'remarks': len(get_reports_by_status('remarks', year_filter, quarter_filter, region_filter)),
        'to_download': len(get_reports_by_status('to_download', year_filter, quarter_filter, region_filter)),
        'all_reports': len(get_reports_by_status('all_reports', year_filter, quarter_filter, region_filter))
    }
    
    return jsonify({
        'success': True,
        'reports': reports_data,
        'stats': stats,
        'total': total_count,
        'page': page,
        'per_page': per_page,
        'has_more': end < total_count,
        'count': len(reports_data)
    })

@views.route('/audit-area/report/<int:id>', methods=['GET'])
@login_required
@session_required
@profile_complete
@auditors_only
def audit_report(id):
    dirUnit = DirUnit.query.filter_by().all()
    dirProduct = DirProduct.query.filter_by().all()
    current_version = Version_report.query.filter_by(id=id).first()
    current_report = Report.query.filter_by(id=current_version.report_id).first()
    tickets = Ticket.query.filter_by(version_report_id = current_version.id).all()
    sections_fuel = Sections.query.filter_by(id_version=current_version.id, section_number=1).order_by(asc(Sections.code_product)).all()
    sections_heat = Sections.query.filter_by(id_version=current_version.id, section_number=2).order_by(asc(Sections.code_product)).all()
    sections_electro = Sections.query.filter_by(id_version=current_version.id, section_number=3).order_by(asc(Sections.code_product)).all()

    return render_template('audit_report.html', 
        id_report = id,
        sections_fuel=sections_fuel,   
        sections_heat=sections_heat,  
        sections_electro=sections_electro,      
        dirUnit=dirUnit,
        dirProduct=dirProduct,
        current_user=current_user, 
        current_report=current_report,
        current_version=current_version,
        tickets=tickets,
        auditAreaReportInfoModal = True
    )


@views.route('/FAQ', methods=['GET'])
def FAQ():
    return render_template('FAQ.html', 
        current_user=current_user
    )

@views.route('/news/<int:id>', methods=['GET'])
def news_post(id):
    post = News.query.filter_by(id = id).first()
    return render_template(f'news_id.html', 
        current_user=current_user,
        post=post
    )

@views.route('/news', methods=['GET'])
def news():
    all_news = News.query.order_by(News.created_time.desc()).all()
    return render_template('news.html', 
        current_user=current_user,
        all_news=all_news
    )

@views.route('/contacts', methods=['GET'])
def contacts():
    return render_template('contacts.html', 
        current_user=current_user
    )
    
@views.route('/api/online-count', methods=['GET'])
def api_online_count():
    try:
        five_minutes_ago = current_utc_time() - timedelta(minutes=5)
        count = User.query.filter(User.last_active >= five_minutes_ago).count()
        return jsonify({
            'success': True,
            'count': count
        })
    except Exception as e:
        current_app.logger.error(f"Error in online count API: {e}")
        return jsonify({
            'success': False,
            'count': 0
        }), 500