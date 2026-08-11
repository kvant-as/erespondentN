import os
import re

from io import BytesIO

import uuid
import random
import string

from decimal import Decimal
from datetime import datetime, timedelta

from flask import (
    Blueprint, current_app, jsonify, render_template, request, flash, redirect, session,
    url_for, send_file, make_response
)

import threading
import time
from flask import current_app, copy_current_request_context

from flask_login import (
    login_user, logout_user, current_user,
    login_required, LoginManager
)

from sqlalchemy import func
from sqlalchemy.orm import joinedload
from website.report import check_version_editable, control_func, create_section, get_organizations_with_reports_excel_xlsx, process_section_calculations, redirect_back, subtract_from_aggregated_sections, to_decimal, update_aggregated_sections, update_section_fields, update_version_status
from ..export import create_archive_async, generate_excel_report, create_xml_for_version, export_tasks
from werkzeug.security import check_password_hash, generate_password_hash

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics

from .. import db
from ..models import (
    User, Organization, Report, Version_report, DirUnit,
    DirProduct, Sections, Ticket, Message
)

from website.ecp import check_certificate_expiry
from website.sessions import clear_session_cookie, create_login_response, session_required
from ..time import current_utc_time
from ..email import send_email

auth = Blueprint('auth', __name__)
login_manager = LoginManager()

@login_manager.user_loader
def load_user(id):
    return User.query.get(int(id))

def send_activation_email(email):
    message = gener_password()
    session['activation_code'] = message
    send_email(message, email, 'code')

def gener_password():
    length=5
    characters = string.digits
    password = ''.join(random.choice(characters) for _ in range(length))
    return password

@auth.route('/login', methods=['POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        remember = True if request.form.get('remember') else False

        if email and password:
            user = User.query.filter(func.lower(User.email) == func.lower(email)).first()
            if user:
                if check_password_hash(user.password, password):
                    login_user(user, remember=remember)
                    
                    user.last_active = current_utc_time()
                    db.session.commit()

                    response = create_login_response(user)
                    flash('Авторизация прошла успешно', 'success')
                    return response
                
            flash('Неправильный email или пароль', 'error')
        else:
            flash('Введите данные для авторизации', 'error')

    return redirect(url_for('views.login'))

@auth.route('/logout')
@login_required
def logout():
    response = make_response(redirect(url_for('views.login')))
    response = clear_session_cookie(response)
    logout_user()

    flash('Выполнен выход из аккаунта', 'success')
    return response

@auth.route('/sign', methods=['POST'])
def sign():
    if request.method == 'POST':
        email = request.form.get('email')
        password1 = request.form.get('password1')
        password2 = request.form.get('password2')
        if email and password1:
            if User.query.filter(func.lower(User.email) == func.lower(email)).first():
                flash('Пользователь с таким email уже существует', 'error')
            elif not re.match(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$', email):
                flash('Некорректный адрес электронной почты', 'error') 
            elif password1 != password2:
                flash('Ошибка в подтверждении пароля', 'error') 
            else:      
                session['temp_user'] = {
                    'email': email,
                    'password': generate_password_hash(password1)
                }
                session.permanent = True
                send_activation_email(email) 
                flash('Проверьте свою почту для активации аккаунта', 'success')
                return redirect(url_for('views.code'))
        else:
            flash('Введите данные для регистрации', 'error')    
    return redirect(url_for('views.sign'))

@auth.route('/code', methods=['POST'])
def code():
    if request.method == 'POST':
        input_code = ''.join([
            request.form.get(f'activation_code_{i}', '') for i in range(5)
        ])
        
        if 'temp_user' not in session or 'activation_code' not in session:
            flash('Сессия истекла. Пожалуйста, начните регистрацию заново', 'error')
            return redirect(url_for('views.sign'))
        
        if input_code == session.get('activation_code'):
            new_user = User(
                email=session['temp_user']['email'],
                password=session['temp_user']['password']
            )
            db.session.add(new_user)
            db.session.commit()
            
            remember = True
            new_user.last_active = current_utc_time()
            db.session.commit()
            
            session.pop('temp_user', None)
            session.pop('activation_code', None)
            
            response = create_login_response(new_user)
            login_user(new_user, remember=remember)
            send_email('', new_user.email, 'registration')
            flash('Аккаунт успешно активирован! Теперь перейдите к заполнению профиля!', 'success')
            return response
        else:
            flash('Некорректный код активации', 'error')
    return redirect(url_for('views.code'))

@auth.route('/resend-code', methods=['POST'])
def resend_code():
    email = session.get('temp_user', {}).get('email')
    if email:
        new_activation_code = gener_password()
        session['activation_code'] = new_activation_code
        send_email(new_activation_code, email, 'code')
        return jsonify({'status': 'success'})
    else:
        return jsonify({'status': 'error', 'message': 'Не удалось отправить код повторно.'}), 400

@auth.route('/add-personal-parametrs', methods=['POST'])
@login_required 
@session_required
def add_personal_parametrs():
    if request.method == 'POST':
        
        name = request.form.get('name_common', '').strip()
        second_name = request.form.get('second_name_common', '').strip()
        patronymic = request.form.get('patronymic_common', '').strip()
        telephone = request.form.get('telephone_common', '').strip()
        
        id_org = request.form.get('id_org', '').strip()

        if not all([name, second_name, telephone]):
            flash('Заполните все обязательные поля', 'error')
            return redirect(url_for('views.profile_common'))

        fio = f"{second_name} {name} {patronymic}".strip()
        current_user.fio = fio
        db.session.commit()


        existing_telephone = User.query.filter(User.id != current_user.id, User.telephone == telephone).first()
        if existing_telephone:
            flash('Пользователь с таким номером телефона уже существует', 'error')
            return redirect(url_for('views.profile_common'))
        current_user.telephone = telephone
        db.session.commit()
        
        if not all([id_org]):
            flash('Выберите предприятие', 'error')
            return redirect(url_for('views.profile_common'))
        
        organization = Organization.query.filter_by(id=id_org).first()
        if not organization:
            flash('Организация не найдена', 'error')
            return redirect(url_for('views.profile_common'))
        db.session.commit()

        # existing_userOrg = User.query.filter_by(organization_id=organization.id).first()
        # if existing_userOrg and existing_userOrg.id != current_user.id:
        #     flash('Аккаунт с такой организацией уже существует', 'error')
        #     return redirect(url_for('views.profile_common'))
        
        current_user.organization_id = organization.id
        
        session.pop('temp_user', None)
        session.pop('activation_code', None)
        
        db.session.commit()
        flash('Данные успешно обновлены', 'success')
        
    return redirect(url_for('views.profile_common'))

@auth.route('/profile/password', methods=['POST'])
@login_required
def profile_password():
    if request.method == 'POST':
        old_password = request.form.get('old_password')
        new_password = request.form.get('new_password')
        conf_new_password = request.form.get('conf_new_password')
        
        if not (old_password and new_password and conf_new_password):
            flash('Введите все поля для смены пароля', 'error')
            return redirect(url_for('views.profile_password'))

        if not check_password_hash(current_user.password, old_password):
            flash('Неправильный старый пароль', 'error')
            return redirect(url_for('views.profile_password'))

        if new_password != conf_new_password:
            flash('При подтверждении пароля произошла ошибка', 'error')
            return redirect(url_for('views.profile_password'))

        user = User.query.filter_by(id=current_user.id).first()
        user.password = generate_password_hash(new_password)
        db.session.commit()

        send_email('Вы успешно изменили свой пароль для входа в учетную запись ErespondentN', current_user.email, 'notification')

        response = make_response(redirect(url_for('views.login')))
        response = clear_session_cookie(response)
        logout_user()
    
        flash('Пароль изменён. Выполнен выход из системы', 'success')
        return response
    return redirect(url_for('views.profile_password'))

@auth.route('/relod-password', methods=['POST'])
def relod_password():
    email = request.form.get('email_relod')
    if not email:
        flash('Пожалуйста, введите свой email, затем нажмите «Забыли пароль?» для восстановления доступа', 'error')
        return redirect(url_for('views.login'))
    user = User.query.filter(func.lower(User.email) == func.lower(email)).first()
    if user:
        new_password = gener_password()
        hashed_password = generate_password_hash(new_password)

        # user_agent_string = request.headers.get('User-Agent')
        # ip_address, location, os, browser = get_location_info(user_agent_string)
        
        send_email(new_password, email, 'new_pass')
        flash('Новый пароль был отправлен вам на email', 'success')
        user.password = hashed_password
        db.session.commit()
        return redirect(url_for('views.login'))
    else:
        flash('Пользователя с таким email не существует', 'error')
        return redirect(url_for('views.login'))
    
@auth.route('/profile/danger-zone', methods=['POST', 'GET'])
@login_required
def profile_danger():
    if request.method == 'POST':
        pass
    return render_template('profile_danger.html', 
                    user=current_user, 
                    active_tab  = 'danger')
    
@auth.route('/delete-account', methods=['POST'])
@login_required
def delete_account():
    try:
        confirm_email = request.form.get('confirm_email', '').strip()
        
        if not confirm_email:
            flash('Email не указан', 'error')
            return redirect(url_for('auth.profile_danger'))
        
        if confirm_email != current_user.email:
            flash('Email не совпадает. Введите правильный адрес для подтверждения удаления', 'error')
            return redirect(url_for('auth.profile_danger'))
        
        user = User.query.get(current_user.id)
        
        if not user:
            flash('Пользователь не найден', 'error')
            return redirect(url_for('auth.profile_danger'))
        
        has_approved = db.session.query(
            db.session.query(Version_report)
            .join(Report)
            .filter(
                Report.user_id == current_user.id,
                Version_report.status == 'Одобрен'
            )
            .exists()
        ).scalar()
        
        if has_approved:
            flash('Невозможно удалить аккаунт, так как есть отчеты со статусом "Одобрен"', 'error')
            return redirect(url_for('auth.profile_danger'))     
           
        if current_user.type == 'Администратор':
            flash('Невозможно удалить аккаунт  администратора', 'error')
            return redirect(url_for('auth.profile_danger'))
        
        db.session.delete(user)
        db.session.commit()
        
        logout_user()
        
        flash(f'Аккаунт {user.email} успешно удален', 'success')
        return redirect(url_for('auth.sign'))
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Ошибка при удалении аккаунта: {str(e)}')
        flash('Произошла ошибка при удалении аккаунта. Попробуйте позже', 'error')
        return redirect(url_for('auth.profile_danger'))
    
@auth.route('/change-email', methods=['GET', 'POST'])
@login_required
def change_email():
    if request.method == 'GET':
        return render_template('edit_email.html', user=current_user, active_tab='common')
    
    elif request.method == 'POST':
        code = request.form.get('code')
        
        if code:
            new_email = session.get('new_email')
            stored_code = session.get('email_confirmation_code')
            expires = session.get('email_confirmation_expires')
            
            if not new_email or not stored_code:
                return jsonify({'success': False, 'message': 'Сессия истекла. Попробуйте снова'}), 400
            
            if expires:
                expires_dt = datetime.fromisoformat(expires)
                if datetime.utcnow() > expires_dt:
                    session.pop('new_email', None)
                    session.pop('email_confirmation_code', None)
                    session.pop('email_confirmation_expires', None)
                    return jsonify({'success': False, 'message': 'Код подтверждения истек. Запросите новый'}), 400
            
            if code != stored_code:
                return jsonify({'success': False, 'message': 'Неверный код подтверждения'}), 400
            
            try:
                old_email = current_user.email
                current_user.email = new_email
                
                session.pop('new_email', None)
                session.pop('email_confirmation_code', None)
                session.pop('email_confirmation_expires', None)
                
                db.session.commit()
                
                try:
                    send_email(
                        recipient_email=new_email,
                        message=f'Ваш email был изменен с {old_email} на {new_email}',
                        email_type="notification"
                    )
                except Exception as e:
                    current_app.logger.warning(f"Could not send notification: {str(e)}")
                
                return jsonify({'success': True, 'message': 'Email успешно изменен', 'new_email': new_email})
                
            except Exception as e:
                db.session.rollback()
                current_app.logger.error(f"Error changing email: {str(e)}")
                return jsonify({'success': False, 'message': 'Произошла ошибка при изменении email'}), 500
        
        else:
            new_email = request.form.get('new_email')
            password = request.form.get('password')
            
            if not new_email or not password:
                return jsonify({'success': False, 'message': 'Заполните все поля'}), 400
            
            if not check_password_hash(current_user.password, password):
                return jsonify({'success': False, 'message': 'Неверный пароль'}), 400
            
            existing_user = User.query.filter(func.lower(User.email) == func.lower(new_email)).first()
            if existing_user and existing_user.id != current_user.id:
                return jsonify({'success': False, 'message': 'Пользователь с таким email уже существует'}), 400
            
            if new_email.lower() == current_user.email.lower():
                return jsonify({'success': False, 'message': 'Новый email совпадает с текущим'}), 400
            
            try:
                import secrets
                import string
                confirmation_code = ''.join(secrets.choice(string.digits) for _ in range(6))
                
                session['new_email'] = new_email
                session['email_confirmation_code'] = confirmation_code
                session['email_confirmation_expires'] = (datetime.utcnow() + timedelta(minutes=10)).isoformat()
                
                send_email(
                    recipient_email=new_email,
                    message=f'{confirmation_code}',
                    email_type="code"
                )
                
                return jsonify({'success': True, 'message': 'Код подтверждения отправлен на новый email', 'new_email': new_email})
                
            except Exception as e:
                current_app.logger.error(f"Error sending confirmation email: {str(e)}")
                return jsonify({'success': False, 'message': 'Ошибка при отправке кода подтверждения'}), 500


@auth.route('/resend-email-code', methods=['POST'])
@login_required
def resend_email_code():
    try:
        data = request.get_json()
        new_email = session.get('new_email')
        
        if not new_email:
            return jsonify({'success': False, 'message': 'Сессия истекла. Попробуйте снова'}), 400
        
        import secrets
        import string
        confirmation_code = ''.join(secrets.choice(string.digits) for _ in range(6))
        session['email_confirmation_code'] = confirmation_code
        session['email_confirmation_expires'] = (datetime.utcnow() + timedelta(minutes=10)).isoformat()
        
        send_email(
            recipient_email=new_email,
            message=f'{confirmation_code}',
            email_type="code"
        )
        
        return jsonify({'success': True, 'message': 'Новый код отправлен на почту'})
        
    except Exception as e:
        current_app.logger.error(f"Error resending confirmation code: {str(e)}")
        return jsonify({'success': False, 'message': 'Ошибка при отправке кода'}), 500


@auth.route('/clear-email-session', methods=['POST'])
@login_required
def clear_email_session():
    try:
        session.pop('new_email', None)
        session.pop('email_confirmation_code', None)
        session.pop('email_confirmation_expires', None)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500