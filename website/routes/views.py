from decimal import Decimal
from io import BytesIO
import os
# from tkinter.tix import Meter
from flask import Blueprint, current_app, make_response, render_template, redirect, url_for, flash, request, jsonify, session
from flask_login import current_user, login_required

from website.ecp import check_certificate_expiry
from website.export import generate_excel_report,  get_reports_by_status
from website.report import check_version_editable, control_func, parse_int, create_section, ZERO_DECIMAL,  get_organizations_with_reports_excel_xlsx, process_section_calculations, redirect_back, subtract_from_aggregated_sections, to_decimal, update_aggregated_sections, update_section_fields, update_version_status
from website.organization import create_new_organization, update_organization_data_with_delay, validate_okpo, validate_ynp


from ..email import send_email
from website.sessions import session_required
from ..models import User, Organization, Report, Version_report, Ticket, DirUnit, DirProduct, Sections, Message, News
from .. import db
from sqlalchemy import asc, case, desc
from functools import wraps

from datetime import datetime, timedelta
from ..time import current_utc_time, get_previous_quarter, get_report_year

from reportlab.lib.pagesizes import letter
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics

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
        current_app.logger.debug("Все сообщения удалены")
            
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
        try:
            send_email(reply_text, recipient.email, 'notification')
        except Exception as e:
            views.logger.error(f"Ошибка отправки email: {str(e)}")
        
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



@views.route('/profile/password', methods=['GET'])
@login_required
@session_required
def profile_password():
    return render_template('profile_password.html', 
                    user=current_user, 
                    active_tab  = 'pass')

@views.route('/reports', methods=['GET'])
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

@views.route('/reports/<string:report_type>/<int:id>', methods=['GET'])
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

@views.route('/reports/report-info/<int:id>', methods=['GET'])
@profile_complete
@login_required
@session_required
@owner_only
@respondent_only
def report_info(id):
    current_version = Version_report.query.filter_by(report_id=id).first()
    current_report = Report.query.filter_by(id=current_version.report_id).first()
    
    auditor_info = get_auditor_info_by_user(current_user)
    
    return render_template('report_review.html', 
        current_user=current_user, 
        current_report=current_report,
        current_version=current_version,
        SentModal = True,
        reportAreaReportInfoModal = True,
        auditor_info=auditor_info,
        section_number = 4
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
    
@views.route('/create-report', methods=['POST'])
@login_required 
@session_required
def create_report():
    if request.method == 'POST': 
        year =  parse_int(request.form.get('modal_add_year'))
        quarter =  parse_int(request.form.get('modal_add_quarter'))
        
        organization = current_user.organization
        
        has_report = Report.query.filter_by(
            org_id=organization.id, 
            year = year, 
            quarter=quarter,
            user_id = current_user.id).first()
        
        if not has_report:
            new_report = Report(
                org_id=organization.id,
                year=year,
                quarter=quarter,
                user_id = current_user.id
            )
            db.session.add(new_report)
            db.session.commit()
            new_version_report = Version_report(
                begin_time = current_utc_time(), 
                status = "Заполнение",
                fio = current_user.fio,
                telephone = current_user.telephone,
                email = current_user.email,
                report=new_report
            )
            db.session.add(new_version_report)
            db.session.commit() 

            sections = Sections.query.filter_by(id_version=new_version_report.id).all()
            if not sections:
                id = new_version_report.id
                is9010productFuel = DirProduct.query.filter_by(CodeProduct='9010', IsFuel = True, DateEnd = None).first()
                is9010productHeat = DirProduct.query.filter_by(CodeProduct='9010', IsHeat = True, DateEnd = None).first()
                is9010productElectro = DirProduct.query.filter_by(CodeProduct='9010', IsElectro = True, DateEnd = None).first()
                is9001productFuel = DirProduct.query.filter_by(CodeProduct='9001', IsFuel = True, DateEnd = None).first()
                is9001productHeat = DirProduct.query.filter_by(CodeProduct='9001', IsHeat = True, DateEnd = None).first()
                is9001productElectro = DirProduct.query.filter_by(CodeProduct='9001', IsElectro = True, DateEnd = None).first()
                
                sections_data = [
                    (is9010productFuel.id, is9010productFuel.CodeProduct, 1),
                    (is9001productFuel.id, is9001productFuel.CodeProduct, 1),
                    
                    (is9010productElectro.id, is9010productElectro.CodeProduct, 2),
                    (is9001productElectro.id, is9001productElectro.CodeProduct, 2),
                    
                    (is9010productHeat.id, is9010productHeat.CodeProduct, 3),
                    (is9001productHeat.id, is9001productHeat.CodeProduct, 3),
                
                ]
                for data in sections_data:
                    section = Sections(
                        id_version=id,
                        id_product=data[0],
                        code_product=data[1],
                        section_number=data[2],
                        produced=Decimal('0.00'),
                        Consumed_Quota=Decimal('0.00'),
                        Consumed_Fact=Decimal('0.00'),
                        Consumed_Total_Quota=Decimal('0.00'),
                        Consumed_Total_Fact=Decimal('0.00'),
                        total_differents=Decimal('0.00'),
                        Oked='',
                        note=''
                    )
                    db.session.add(section)
                db.session.commit()
            flash(f'Отчет {year}/{quarter} успешно создан.', 'success')
        else:
            flash(f'Отчет {year} года {quarter} квартала уже существует.', 'error')
    return redirect(url_for('views.report_area'))

@views.route('/change-period-report', methods=['POST'])
@login_required 
@session_required
def change_period_report():
    if request.method == 'POST':
        id = int(request.form.get('modal_change_report_id'))
        year = request.form.get('modal_change_report_year')
        quarter = request.form.get('modal_change_report_quarter')  
         
        current_report = Report.query.filter_by(id=id).first()
        versions = Version_report.query.filter_by(report_id=id).all()

        if current_report:
            existing_report = Report.query.filter_by(
                user_id=current_user.id,
                year=year,
                quarter=quarter
            ).first()

            sent_version_exists = any(version.status == 'Отправлен' for version in versions)
            if sent_version_exists:
                flash('После отправки изменение отчета недоступно.', 'error')
                return redirect(url_for('views.report_area'))
            
            confirmed_version_exists = any(version.status == 'Одобрен' for version in versions)
            if confirmed_version_exists:
                flash('Одобренные отчеты не подлежат редактированию.', 'error')
                return redirect(url_for('views.report_area'))
            
            if existing_report and existing_report.id != id:
                flash('Отчет с таким годом и кварталом уже существует.', 'error')
                return redirect(url_for('views.report_area'))

            current_report.year = year
            current_report.quarter = quarter
            db.session.commit()
            flash('Параметры обновлены.', 'success')
        else:
            flash('Отчет не найден.', 'error')

        return redirect(url_for('views.report_area'))
  
@views.route('/copy-report', methods=['POST'])
@login_required 
@session_required
def copy_report():
    if request.method == 'POST':
        try:
            copy_report_id = parse_int(request.form.get('modal_copy_report_id'))
            new_year = parse_int(request.form.get('modal_copy_report_year'))
            new_quarter = parse_int(request.form.get('modal_copy_report_quarter'))
            
            if not all([copy_report_id, new_year, new_quarter]):
                flash('Не все данные заполнены', 'error')
                return redirect(url_for('views.report_area'))

            original_report = Report.query.get(copy_report_id)
            if not original_report:
                flash('Исходный отчет не найден', 'error')
                return redirect(url_for('views.report_area'))
            
            existing_report = Report.query.filter_by(
                org_id=current_user.organization.id,
                year=new_year,
                quarter=new_quarter,
                user_id=current_user.id
            ).first()
            
            if existing_report:
                flash(f'Отчет {new_year} года {new_quarter} квартала уже существует.', 'error')
                return redirect(url_for('views.report_area'))
            
            original_version = Version_report.query.filter_by(
                report_id=copy_report_id
            ).order_by(Version_report.begin_time.desc()).first()
            
            if not original_version:
                flash('Версия исходного отчета не найдена', 'error')
                return redirect(url_for('views.report_area'))
            
            new_report = Report(
                org_id=current_user.organization.id,
                year=new_year,
                quarter=new_quarter,
                user_id=current_user.id
            )
            db.session.add(new_report)
            db.session.flush()
            
            new_version = Version_report(
                begin_time=current_utc_time(),
                status="Заполнение",
                fio=current_user.fio,
                telephone=current_user.telephone,
                email=current_user.email,
                report_id=new_report.id
            )
            db.session.add(new_version)
            db.session.flush()
            
            specific_codes = ['9001', '9010', '9100']
            
            original_sections = Sections.query.filter_by(
                id_version=original_version.id
            ).filter(
                ~Sections.code_product.in_(specific_codes)
            ).order_by(Sections.id.asc()).all()
            
            copied_count = 0
            skipped_count = 0
            
            for section in original_sections:
                if not section.product:
                    skipped_count += 1
                    continue
                
                current_product = DirProduct.query.filter_by(
                    CodeProduct=section.product.CodeProduct
                ).first()
                
                if not current_product:
                    skipped_count += 1
                    continue
                
                if current_product.DateEnd is not None:
                    current_product = DirProduct.query.filter_by(
                        CodeProduct=section.product.CodeProduct,
                        DateEnd=None
                    ).first()
                    
                    if not current_product:
                        skipped_count += 1
                        continue
                
                new_section = Sections(
                    id_version=new_version.id,
                    id_product=current_product.id,
                    code_product=current_product.CodeProduct,
                    section_number=section.section_number,
                    Oked=section.Oked,
                    produced=section.produced,
                    Consumed_Quota=section.Consumed_Quota,
                    Consumed_Fact=section.Consumed_Fact,
                    Consumed_Total_Quota=section.Consumed_Total_Quota,
                    Consumed_Total_Fact=section.Consumed_Total_Fact,
                    total_differents=section.total_differents,
                    note=section.note
                )
                db.session.add(new_section)
                copied_count += 1
            
            is9010productFuel = DirProduct.query.filter_by(CodeProduct='9010', IsFuel=True, DateEnd=None).first()
            is9010productHeat = DirProduct.query.filter_by(CodeProduct='9010', IsHeat=True, DateEnd=None).first()
            is9010productElectro = DirProduct.query.filter_by(CodeProduct='9010', IsElectro=True, DateEnd=None).first()
            is9001productFuel = DirProduct.query.filter_by(CodeProduct='9001', IsFuel=True, DateEnd=None).first()
            is9001productHeat = DirProduct.query.filter_by(CodeProduct='9001', IsHeat=True, DateEnd=None).first()
            is9001productElectro = DirProduct.query.filter_by(CodeProduct='9001', IsElectro=True, DateEnd=None).first()
            
            sections_data = [
                (is9010productFuel.id, is9010productFuel.CodeProduct, 1),
                (is9001productFuel.id, is9001productFuel.CodeProduct, 1),
                (is9010productElectro.id, is9010productElectro.CodeProduct, 2),
                (is9001productElectro.id, is9001productElectro.CodeProduct, 2),
                (is9010productHeat.id, is9010productHeat.CodeProduct, 3),
                (is9001productHeat.id, is9001productHeat.CodeProduct, 3),
            ]
            
            for data in sections_data:
                section = Sections(
                    id_version=new_version.id,
                    id_product=data[0],
                    code_product=data[1],
                    section_number=data[2],
                    produced=Decimal('0.00'),
                    Consumed_Quota=Decimal('0.00'),
                    Consumed_Fact=Decimal('0.00'),
                    Consumed_Total_Quota=Decimal('0.00'),
                    Consumed_Total_Fact=Decimal('0.00'),
                    total_differents=Decimal('0.00'),
                    Oked='',
                    note=''
                )
                db.session.add(section)
            
            db.session.commit()
            
            for section_number in [1, 2, 3]:
                update_aggregated_sections(new_version.id, section_number)
            
            message = f'Отчет успешно скопирован'
            if skipped_count > 0:
                message += f', пропущено продуктов: {skipped_count}'
            
            flash(message, 'success')
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f'Ошибка при копировании отчета: {str(e)}')
            flash(f'Ошибка при копировании: {str(e)}', 'error')
            
        return redirect(url_for('views.report_area'))

@views.route('/delete-report/<report_id>', methods=['POST'])
@login_required 
@session_required
def delete_report(report_id):
    if request.method == 'POST':
        try:
            current_report = Report.query.filter_by(id=report_id).first()
            if not current_report:
                flash('Отчет не найден.', 'error')
                return redirect(url_for('views.report_area'))
            
            versions = Version_report.query.filter_by(report_id=report_id).all()
            tickets = Ticket.query.filter_by(version_report_id=report_id).all()
            
            sent_version_exists = any(version.status == 'Отправлен' for version in versions)
            if sent_version_exists:
                flash('Отправленный отчет не подлежит удалению.', 'error')
                return redirect(url_for('views.report_area'))
            
            confirmed_version_exists = any(version.status == 'Одобрен' for version in versions)
            if confirmed_version_exists:
                flash('Данный отчет не подлежит удалению.', 'error')
                return redirect(url_for('views.report_area'))
            
            for ticket in tickets:
                db.session.delete(ticket)
            
            for version in versions:
                sections = Sections.query.filter_by(id_version=version.id).all()
                for section in sections:
                    db.session.delete(section)
                db.session.delete(version)
            
            db.session.delete(current_report)
            db.session.commit()
            flash('Отчет удален.', 'success')
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f'Ошибка при удалении отчета {report_id}: {str(e)}', exc_info=True)
            flash('Произошла ошибка при удалении отчета.', 'error')
        
        return redirect(url_for('views.report_area'))


@views.route('/add-section', methods=['POST'])
@login_required 
@session_required
def add_section():
    if request.method == 'POST':
        try:
            data = {
                'current_version_id': request.form.get('current_version'),
                'add_id_product': request.form.get('add_id_product'),
                'oked': request.form.get('oked_add'),
                'produced': to_decimal(request.form.get('produced_add')),
                'Consumed_Quota': to_decimal(request.form.get('Consumed_Quota_add')),
                'Consumed_Fact': to_decimal(request.form.get('Consumed_Fact_add')),
                'Consumed_Total_Quota': to_decimal(request.form.get('Consumed_Total_Quota_add')),
                'Consumed_Total_Fact': to_decimal(request.form.get('Consumed_Total_Fact_add')),
                'note': request.form.get('note_add'),
                'section_number': request.form.get('section_number')
            }
            
            current_product = DirProduct.query.filter_by(id=data['add_id_product']).first()
            if not current_product:
                flash('Продукт не найден в справочнике.', 'error')
                return redirect(request.referrer)
            
            current_version = Version_report.query.filter_by(id=data['current_version_id']).first()
            if not check_version_editable(current_version):
                return redirect(request.referrer)
            
            product_unit = DirUnit.query.filter_by(IdUnit=current_product.IdUnit).first()
            
            existing = Sections.query.filter_by(
                id_version=data['current_version_id'],
                section_number=data['section_number'],
                id_product=current_product.id
            ).first()
            
            if existing and not data['note']:
                flash('«Примечание» обязательно для заполнения, так как такая продукция уже есть.', 'error')
                return redirect(request.referrer)
            
            new_section = create_section(data, current_product.id, current_product.CodeProduct)
            db.session.add(new_section)
            db.session.commit()
            
            if current_product.CodeProduct == "7000":
                new_section.total_differents = new_section.Consumed_Total_Fact - new_section.Consumed_Total_Quota
            else:
                process_section_calculations(new_section, product_unit)
            
            db.session.commit()
            
            update_aggregated_sections(data['current_version_id'], data['section_number'])
            update_version_status(current_version)
            
            flash('Продукция была добавлена.', 'success')
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(
                f'Ошибка при добавлении секции. Version: {data.get("current_version_id")}, '
                f'Product: {data.get("add_id_product")}, Error: {str(e)}',
                exc_info=True
            )
            flash('Произошла ошибка при добавлении продукции.', 'error')
        
        return redirect(request.referrer)


@views.route('/change-section', methods=['POST'])
@login_required 
@session_required
def change_section():
    if request.method == 'POST':
        try:
            id_version = request.form.get('current_version')
            id_section = request.form.get('id')
            
            current_version = Version_report.query.filter_by(id=id_version).first()
            if not check_version_editable(current_version):
                return redirect_back(current_version)
            
            current_section = Sections.query.filter_by(id=id_section).first()
            if not current_section:
                flash('Ошибка при обновлении.', 'error')
                return redirect_back(current_version)
            
            current_product = DirProduct.query.filter_by(id=current_section.id_product).first()
            product_unit = DirUnit.query.filter_by(IdUnit=current_product.IdUnit).first() if current_product else None
            
            update_section_fields(current_section, request.form, product_unit)
            
            update_aggregated_sections(id_version, current_section.section_number)
            update_version_status(current_version)
            
            db.session.commit()
            flash('Параметры обновлены.', 'success')
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(
                f'Ошибка при обновлении секции. Section: {id_section}, '
                f'Version: {id_version}, Error: {str(e)}',
                exc_info=True
            )
            flash('Произошла ошибка при обновлении параметров.', 'error')
        
        return redirect_back(current_version, current_section.section_number if current_section else None)


@views.route('/remove_section/<id>', methods=['POST'])
@login_required 
@session_required
def remove_section(id):
    if request.method == 'POST':
        try:
            delete_section = Sections.query.filter_by(id=id).first()
            if not delete_section:
                flash('Ошибка при удалении', 'error')
                return redirect(request.referrer)
            
            current_version = Version_report.query.filter_by(id=delete_section.id_version).first()
            if not check_version_editable(current_version):
                return redirect(request.referrer)
            
            subtract_from_aggregated_sections(delete_section)
            
            db.session.delete(delete_section)
            db.session.commit()
            
            update_version_status(current_version)
            flash('Продукция была удалена.', 'success')
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(
                f'Ошибка при удалении секции. Section: {id}, '
                f'Version: {delete_section.id_version if delete_section else "Unknown"}, '
                f'Error: {str(e)}',
                exc_info=True
            )
            flash('Произошла ошибка при удалении продукции.', 'error')
        
        return redirect_back(current_version, delete_section.section_number if delete_section else None)

@views.route('/control-version/<id>', methods=['POST'])
@login_required 
@session_required
def control_version(id):
    if request.method == 'POST':
        return control_func(id)

@views.route('/agreed-version/<id>', methods=['POST'])
@login_required 
@session_required
def agreed_version(id):
    if request.method == 'POST':
        current_version = Version_report.query.filter_by(id=id).first()
        if current_version.status == 'Контроль пройден':     
            current_version.status = 'Согласовано'
            db.session.commit()
            flash('Отчет согласован.', 'successful')
        elif current_version.status == 'Согласовано': 
            flash('Отчет уже согласован.', 'succeful')
        else:
            flash('Необходимо пройти контроль.', 'error')
        return redirect(request.referrer)

@views.route('/send-version/<id>', methods=['POST'])
@login_required 
@session_required
def sent_version(id):
    if request.method == 'POST':
        uploaded_file = request.files.get('certificate')
        current_version = Version_report.query.filter_by(id=id).first()
        
        if current_version.status == 'Отправлен':
            flash('Отчет уже отправлен.', 'error')
            return redirect(request.referrer)

        if current_version.status != 'Согласовано':
            flash('Необходимо согласовать.', 'error')
            return redirect(request.referrer)

        ALLOWED_EXTENSIONS = {'cer'}
        def allowed_file(filename):
            return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

        if not uploaded_file:
            flash('Файл сертификата обязателен.', 'error')
            return redirect(request.referrer)

        if not allowed_file(uploaded_file.filename):
            flash('Неверный формат файла. Загрузите файл в формате .cer.', 'error')
            return redirect(request.referrer)

        if not check_certificate_expiry(uploaded_file):
            flash('Срок действия сертификата истёк или файл некорректен.', 'error')
            return redirect(request.referrer)

        current_version.status = 'Отправлен'
        if current_version.sent_time is None:
            current_version.sent_time = current_utc_time()
        db.session.commit()

        flash('Сертификат валидный, отчет отправлен на проверку.', 'successful')
        return redirect(request.referrer)

@views.route('/cancel-sent-version/<id>', methods=['POST'])
@login_required 
@session_required
def cancle_sent_version(id):
    from ..report import cancel_sending
    return cancel_sending(id)

@views.route('/change-category-report', methods=['POST'])
@login_required 
@session_required
def change_category_report():
    try:
        if current_user.type == "Смотрящий":
            flash('У вас нет доступа к этому действию.', 'error')
            return redirect(request.referrer or url_for('views.index'))
        
        action = request.form.get('action')
        report_id = request.form.get('reportId')
        
        if not action or not report_id:
            flash('Недостаточно данных для выполнения операции.', 'error')
            return redirect(request.referrer or url_for('views.index'))
        
        try:
            current_version = Version_report.query.filter_by(report_id=report_id).first()
            if current_version is None:
                flash(f'Версия отчета с ID {report_id} не найдена.', 'error')
                return redirect(request.referrer or url_for('views.index'))
        except Exception as e:
            flash(f'Ошибка при поиске версии отчета: {str(e)}', 'error')
            return redirect(request.referrer or url_for('views.index'))
        
        try:
            recipient_user = User.query.filter_by(email=current_version.email).first()
            if recipient_user is None:
                flash(f'Пользователь с email {current_version.email} не найден.', 'error')
                return redirect(request.referrer or url_for('views.index'))
        except Exception as e:
            flash(f'Ошибка при поиске пользователя: {str(e)}', 'error')
            return redirect(request.referrer or url_for('views.index'))
        
        try:
            report = Report.query.filter_by(id=current_version.report_id).first()
            if report is None:
                flash(f'Отчет с ID {current_version.report_id} не найден.', 'error')
                return redirect(request.referrer or url_for('views.index'))
        except Exception as e:
            flash(f'Ошибка при поиске отчета: {str(e)}', 'error')
            return redirect(request.referrer or url_for('views.index'))
        
        organization_name = report.organization.full_name if report and report.organization else "Неизвестная организация"
        
        if not current_version.hasNot and action != 'to_download':
            flash('Необходимо уточнить о каких ошибках идет речь.', 'error')
            return redirect(url_for('views.audit_report', id=current_version.id, tickets_cont='true'))
        
        status_itog = None
        
        if action == 'not_viewed':
            status_itog = 'Отправлен'
        elif action == 'remarks':
            status_itog = 'Есть замечания'
        elif action == 'to_download':
            status_itog = 'Одобрен'
            try:
                ticket_message = Ticket(
                    note="Ошибок нет, отчет одобрен.",
                    luck=True,
                    version_report_id=current_version.id
                )
                db.session.add(ticket_message)
                db.session.flush()
            except Exception as e:
                db.session.rollback()
                flash(f'Ошибка при создании квитанции: {str(e)}', 'error')
                return redirect(request.referrer or url_for('views.index'))
        elif action == 'to_delete':
            status_itog = 'Готов к удалению'
        else:
            flash('Неизвестное действие.', 'error')
            return redirect(request.referrer or url_for('views.index'))
        
        try:
            current_version.hasNot = False
            current_version.status = status_itog
            current_version.audit_time = current_utc_time()
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            flash(f'Ошибка при обновлении статуса версии отчета: {str(e)}', 'error')
            return redirect(request.referrer or url_for('views.index'))
        
        try:
            user_message_text = f"Статус вашего отчета за {report.year} год {report.quarter} квартал был изменен на «{status_itog}». Дополнительные сведения можно просмотреть в квитанции."
            
            user_message = Message(
                text=user_message_text,
                recipient_id=recipient_user.id
            )
            db.session.add(user_message)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            flash(f'Ошибка при создании уведомления: {str(e)}', 'error')
            return redirect(request.referrer or url_for('views.index'))
        
        try:
            send_email(user_message_text, recipient_user.email, 'notification')
        except Exception as e:
            print(f'Ошибка отправки email: {str(e)}')
            flash('Статус изменен, но возникла ошибка при отправке уведомления на email.', 'warning')
        
        flash(f'Статус отчета "{organization_name}" за {report.year} год {report.quarter} квартал был изменен на «{status_itog}».', 'success')
        return redirect(request.referrer or url_for('views.index'))
        
    except Exception as e:
        db.session.rollback()
        flash(f'Произошла ошибка: {str(e)}', 'error')
        return redirect(request.referrer or url_for('views.index'))
        
@views.route('/rollbackreport/<id>', methods=['POST'])
@login_required 
@session_required
def rollbackreport(id):
    if request.method == 'POST':        
        if current_user.type == "Смотрящий":
            flash('У вас нет доступа к этому действию.', 'error')
            return redirect(request.referrer)
        
        current_version = Version_report.query.filter_by(report_id=id).first()
        recipient_user = User.query.filter_by(email=current_version.email).first()    
        if current_version:
            if current_version.status != 'Отправлен':
                if isinstance(current_version.audit_time, datetime):
                    audit_time = current_version.audit_time
                else:
                    audit_time = datetime.combine(current_version.audit_time, datetime.min.time())

                if audit_time + timedelta(days=92) <= current_utc_time():
                    flash('Прошло больше 3-ех месяцев, статус отчета изменить нельзя.', 'error')
                else: 
                    current_version.status = "Отправлен"
                    current_version.hasNot = False
                 
                    user_message = Message(
                        text = f"Статус отчета был изменен аудитором на «Отправлен».",
                        # sender_id = recipient_user.id,    
                        recipient_id = recipient_user.id      
                    )
                    db.session.add(user_message)
                    db.session.commit()
                    
                    ticket_message = Ticket(
                        note="Возвращён в исходное состояние.",
                        luck=False,
                        version_report_id=current_version.id
                    )
                    db.session.add(ticket_message)
                    db.session.commit()
                    flash('Статус отчёта был изменён на «Непросмотренный».', 'success')
            else:
                flash('Статус отчёта уже установлен как «Непросмотренный».', 'error')
            return redirect(request.referrer)
        else:
            flash('Отчет не найден.', 'error')
    return redirect(request.referrer)

@views.route('/send-comment', methods=['POST'])
@login_required 
@session_required
def send_comment():
    if request.method == 'POST':        
        if current_user.type == "Смотрящий":
            flash('У вас нет доступа к этому действию.', 'error')
            return redirect(request.referrer)
        
        version_id = request.form.get('version_id')
        text = request.form.get('text')

        if not text or text.strip() == '':
            flash("Необходимо ввести текст.", "error")
            return redirect(request.referrer)
        
        cleaned_text = ' '.join(text.split())
        current_version = Version_report.query.filter_by(id=version_id).first()
        current_report = Report.query.get_or_404(version_id)
        
        if current_version:
            new_comment = Ticket(
                note = cleaned_text,
                version_report_id = current_version.id
            )
            db.session.add(new_comment)
            current_version.hasNot = True
            db.session.commit()
            flash('Сообщение отправлено, теперь можно сменить статус.', 'success')
        
            status_mapping = {
                'Отправлен': 'not_viewed',
                'Есть замечания': 'remarks',
                'Одобрен': 'to_download',
                'Готов к удалению': 'to_delete'
            }

            current_status = current_version.status
            url_status = status_mapping.get(current_status, 'all_reports')

            return redirect(url_for('views.audit_area', 
                                status=url_status,
                                year=current_report.year,
                                quarter=current_report.quarter))
        else:
            flash('Отчет не найден.', 'error') 
            return redirect(request.referrer)

@views.route('/export-table', methods=['POST'])
@login_required 
@session_required
def export_table():
    version_id = int(request.form.get('version_id'))
    return generate_excel_report(version_id)

@views.route('/export-version/<id>', methods=['POST'])
@login_required 
@session_required
def export_version(id):
    return generate_excel_report(id)


from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from io import BytesIO
from flask import make_response
import os

@views.route('/print-version-tickets', methods=['POST'])
@login_required 
@session_required
def print_version_tickets():
    if request.method == 'POST':
        version_id = request.form.get('version_id')
        
        tickets = Ticket.query.filter_by(version_report_id=version_id).all()
        
        if not tickets:
            flash("Квитанции не найдены.", "error")
            return redirect(request.referrer)

        version_report = tickets[0].version_report
        report = version_report.report

        buffer = BytesIO()
        c = canvas.Canvas(buffer, pagesize=letter)
        
        left_margin = 72
        right_margin = 72
        page_width = letter[0]
        max_text_width = page_width - left_margin - right_margin

        font_path_bold = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'fonts', 'Montserrat-Bold.ttf')
        font_path_regular = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'fonts', 'Montserrat-Regular.ttf')
        pdfmetrics.registerFont(TTFont('MontserratBold', font_path_bold))
        pdfmetrics.registerFont(TTFont('MontserratRegular', font_path_regular))

        def draw_wrapped_text(c, text, x, y, font_name, font_size, max_width):
            c.setFont(font_name, font_size)
            lines = []
            words = text.split(' ')
            current_line = []
            
            for word in words:
                test_line = ' '.join(current_line + [word])
                if c.stringWidth(test_line, font_name, font_size) <= max_width:
                    current_line.append(word)
                else:
                    if current_line:
                        lines.append(' '.join(current_line))
                    current_line = [word]
            
            if current_line:
                lines.append(' '.join(current_line))
            
            for line in lines:
                if y < 50:
                    c.showPage()
                    y = 750
                c.drawString(x, y, line)
                y -= font_size + 4
            
            return y

        c.setFont("MontserratBold", 16)
        c.drawString(left_margin, 750, "Квитанции по отчету")
        
        c.setFont("MontserratRegular", 12)
        c.drawString(left_margin, 725, f"ОКПО: {report.organization.okpo}")
        c.drawString(left_margin, 705, f"Год: {report.year}, Квартал: {report.quarter}")
        c.drawString(left_margin, 685, f"Всего квитанций: {len(tickets)}")
        
        y_position = 640

        for idx, ticket in enumerate(tickets):
            if y_position < 120:
                c.showPage()
                c.setFont("MontserratBold", 16)
                c.drawString(left_margin, 750, "Квитанции по отчету (продолжение)")
                c.setFont("MontserratRegular", 12)
                c.drawString(left_margin, 725, f"ОКПО: {report.organization.okpo}")
                c.drawString(left_margin, 705, f"Год: {report.year}, Квартал: {report.quarter}")
                y_position = 680

            c.setFont("MontserratBold", 12)
            c.drawString(left_margin, y_position, f"Квитанция #{idx + 1}")
            y_position -= 20
            
            c.setFont("MontserratRegular", 10)
            c.drawString(left_margin, y_position, f"Дата обработки: {ticket.begin_time.strftime('%Y-%m-%d %H:%M') if ticket.begin_time else 'Не указана'}")
            y_position -= 20
            
            c.setFont("MontserratBold", 12)
            c.drawString(left_margin, y_position, "Результат: ")
            c.setFont("MontserratRegular", 12)
            result = "Отчет одобрен, ошибок нет" if ticket.luck else "Отчет не принят в обработку"
            c.drawString(left_margin + 70, y_position, result)
            y_position -= 20
            
            if not ticket.luck and ticket.note:
                c.setFont("MontserratBold", 12)
                c.drawString(left_margin, y_position, "Причина:")
                c.setFont("MontserratRegular", 12)
                y_position = draw_wrapped_text(c, ticket.note, left_margin + 65, y_position, "MontserratRegular", 11, max_text_width - 65)
            
            y_position -= 25

        c.save()
        buffer.seek(0)

        response = make_response(buffer.getvalue())
        response.headers['Content-Type'] = 'application/pdf'
        response.headers['Content-Disposition'] = 'attachment; filename=' + f"kvitancii_{report.organization.okpo}_{report.year}_{report.quarter}.pdf"
        
        return response
        
@views.route('/send_for_admin', methods=['POST'])
@login_required 
@session_required
def send_for_admin():
    if request.method == 'POST':
        question_type = request.form.get('askquestion_type')
        problem_description = request.form.get('problem_description', '')
        organization_name = request.form.get('organization_name', '')
        organization_okpo = request.form.get('organization_okpo', '')
        organization_ynp = request.form.get('organization_ynp', '')
        
        new_organization_name = request.form.get('new_organization_name', '')
        new_organization_okpo = request.form.get('new_organization_okpo', '')
        new_organization_ynp = request.form.get('new_organization_ynp', '')
        selected_org_id = request.form.get('selected_org_id', '')
        
        if not question_type:
            flash('Выберите тип вопроса.', 'error')
            return redirect(url_for('views.beginPage'))
        
        if question_type == 'organization-none':
            if not organization_name or not organization_okpo or not organization_ynp:
                flash('Заполните название организации, УНП и ОКПО.', 'error')
                return redirect(url_for('views.beginPage'))
            
            is_valid_okpo, okpo_error = validate_okpo(organization_okpo)
            if not is_valid_okpo:
                flash(okpo_error, 'error')
                return redirect(url_for('views.beginPage'))
            
            is_valid_ynp, ynp_error = validate_ynp(organization_ynp)
            if not is_valid_ynp:
                flash(ynp_error, 'error')
                return redirect(url_for('views.beginPage'))
            
            create_new_organization(organization_name, organization_okpo, organization_ynp, current_user)
            
        elif question_type == 'organization-edit':
            if not selected_org_id:
                flash('Выберите организацию из списка.', 'error')
                return redirect(url_for('views.beginPage'))
            
            organization = Organization.query.get(selected_org_id)
            if not organization:
                flash('Организация не найдена.', 'error')
                return redirect(url_for('views.beginPage'))
            
            if current_user.organization_id != organization.id:
                flash('Вы можете изменять данные только своей организации.', 'error')
                return redirect(url_for('views.beginPage'))
            
            has_approved_reports = Report.query.join(Version_report).filter(
                Report.org_id == organization.id,
                Version_report.status.in_(["Отправлен", "Одобрен", "Есть замечания", "Готов к удалению"])
            ).first()
            
            if has_approved_reports:
                flash('Нельзя изменить данные организации, так как есть отправленные отчеты.', 'error')
                return redirect(url_for('views.beginPage'))
            
            has_changes = False

            if new_organization_okpo and new_organization_okpo != organization.okpo:
                is_valid, error_msg = validate_okpo(new_organization_okpo)
                if not is_valid:
                    flash(error_msg, 'error')
                    return redirect(url_for('views.beginPage'))
                
                existing_org = Organization.query.filter_by(okpo=new_organization_okpo).first()
                if existing_org and existing_org.id != organization.id:
                    flash('Организация с таким ОКПО уже существует.', 'error')
                    return redirect(url_for('views.beginPage'))
                has_changes = True
                
            if new_organization_ynp and new_organization_ynp != organization.ynp:
                is_valid, error_msg = validate_ynp(new_organization_ynp)
                if not is_valid:
                    flash(error_msg, 'error')
                    return redirect(url_for('views.beginPage'))
                has_changes = True
            
            if new_organization_name and new_organization_name != organization.full_name:
                has_changes = True
            
            if not has_changes:
                flash('Не обнаружено изменений в данных организации.', 'error')
                return redirect(url_for('views.beginPage'))
            
            new_message = Message(
                text=f"Ваше сообщение на редактирование организации было отправлено.",
                recipient_id=current_user.id,
                create_time = current_utc_time()
            )
            db.session.add(new_message)
            db.session.commit()
            
            update_organization_data_with_delay(
                organization_id=organization.id,
                new_name=new_organization_name if new_organization_name else None,
                new_okpo=new_organization_okpo if new_organization_okpo else None,
                new_ynp=new_organization_ynp if new_organization_ynp else None,
                user_id=current_user.id
            )
            
        elif question_type == 'other':
            if not problem_description:
                flash('Опишите ваш вопрос.', 'error')
                return redirect(url_for('views.beginPage'))
            
            admins = User.query.filter_by(type="Администратор").all()
            if admins:
                for admin in admins:
                    new_message = Message(
                        sender_id=current_user.id,
                        text=problem_description,
                        recipient_id=admin.id,
                        create_time = current_utc_time()
                    )
                    db.session.add(new_message)
                db.session.commit()
                flash('Сообщение отправлено администратору.', 'success')
            else:
                flash('Администраторы не найдены.', 'error')
                
            new_message = Message(
                text=f"Ваше сообщение «{problem_description}» было отправлено.",
                recipient_id=current_user.id,
                create_time = current_utc_time()
            )
            db.session.add(new_message)
            db.session.commit()
        else:
            flash('Неверный тип вопроса.', 'error')
            return redirect(url_for('views.beginPage'))
        flash('Ваш вопрос был отправлен.', 'succes')
        
    return redirect(url_for('views.profile'))

@views.route('/load_org_stat', methods=['POST'])
@login_required 
@session_required
def load_org_stat():
    year_filter = request.form.get('modal_add_year')
    quarter_filter = request.form.get('modal_add_quarter')

    if not year_filter or not quarter_filter:
        flash('Не указан год или квартал.', 'error')
        return redirect(request.referrer)

    if current_user.type not in ["Администратор", "Аудитор"]:
        flash('У вас нет доступа к отчетам.', 'error')
        return redirect(request.referrer)

    allowed_statuses = ["Отправлен", "Одобрен", "Есть замечания", "Готов к удалению"]
    file_data = get_organizations_with_reports_excel_xlsx(
        int(year_filter), int(quarter_filter), allowed_statuses
    )

    if not file_data:
        flash('Нет организаций с отправленными отчётами за выбранный период.', 'error')
        return redirect(request.referrer)

    response = make_response(file_data)
    response.headers['Content-Type'] = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    response.headers['Content-Disposition'] = f'attachment; filename=orgs_{year_filter}_{quarter_filter}.xlsx'
    return response