import os
import re

from io import BytesIO

import uuid
import random
import string

from decimal import Decimal
from datetime import datetime, timedelta

from flask import (
    Blueprint, current_app, jsonify, request, flash, redirect, session,
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
from .export import create_archive_async, generate_excel_report, create_xml_for_version, export_tasks
from werkzeug.security import check_password_hash, generate_password_hash

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics

from . import db
from .models import (
    User, Organization, Report, Version_report, DirUnit,
    DirProduct, Sections, Ticket, Message
)

from website.ecp import check_certificate_expiry
from website.sessions import clear_session_cookie, create_login_response, session_required
from .time import current_utc_time
from .email import send_email


def send_delayed_response(user_id, text, delay_seconds=10):
    @copy_current_request_context
    def send_message():
        time.sleep(delay_seconds)
        from website.models import Message, db
        new_message = Message(
            text=text,
            recipient_id=user_id,
            create_time = current_utc_time()
        )
        db.session.add(new_message)
        db.session.commit()
        current_app.logger.error("Сообщение отправлено пользователю.")

    thread = threading.Thread(target=send_message)
    thread.daemon = True
    thread.start()
    current_app.logger.error("Сообщение в обработке.")

def validate_okpo(okpo):
    if len(okpo) != 12:
        return False, "ОКПО должен содержать 12 цифр"
    fourth_from_end = okpo[-4]
    allowed_digits = ['1', '2', '3', '4', '5', '6', '7']
    if fourth_from_end not in allowed_digits:
        return False, "4-я цифра с конца в коде ОКПО должна быть от 1 до 7"
    return True, ""

def validate_ynp(ynp):
    if len(ynp) != 9:
        return False, "УНП должен содержать ровно 9 цифр"
    return True, ""

def update_organization_data_with_delay(organization_id, new_name=None, new_okpo=None, new_ynp=None, user_id=None, delay_seconds=10):
    @copy_current_request_context
    def update_task():
        time.sleep(delay_seconds)
        
        from website.models import Organization, User, Message, Report, Version_report, db
        
        organization = Organization.query.get(organization_id)
        if not organization:
            current_app.logger.error(f"Организация с ID {organization_id} не найдена.")
            return
        
        user = User.query.get(user_id) if user_id else None
        if not user:
            current_app.logger.error(f"Пользователь с ID {user_id} не найден.")
            return
        
        if user.organization_id != organization.id:
            current_app.logger.error(f"Пользователь {user.email} не привязан к организации {organization.id}")
            send_delayed_response(
                user.id,
                "Ошибка: вы не привязаны к этой организации. Изменения не применены.",
                delay_seconds=2
            )
            return
        
        has_approved_reports = Report.query.join(Version_report).filter(
            Report.org_id == organization.id,
            Version_report.status == 'Одобрено'
        ).first()
        
        if has_approved_reports:
            current_app.logger.error(f"У организации {organization.id} есть одобренные отчеты. Редактирование запрещено.")
            send_delayed_response(
                user.id,
                "Ошибка: нельзя изменить данные организации, так как есть одобренные отчеты.",
                delay_seconds=2
            )
            return
        
        changes = []
        
        if new_name and new_name.strip() and new_name != organization.full_name:
            changes.append(f"Наименование: '{organization.full_name}' → '{new_name}'")
            organization.full_name = new_name.strip()
        
        if new_okpo and new_okpo.strip() and new_okpo != organization.okpo:
            is_valid, error_msg = validate_okpo(new_okpo)
            if not is_valid:
                current_app.logger.error(f"Неверный ОКПО: {error_msg}")
                send_delayed_response(user.id, f"Ошибка: {error_msg}. Изменения не применены.", delay_seconds=2)
                return
            
            existing_org = Organization.query.filter_by(okpo=new_okpo).first()
            if existing_org and existing_org.id != organization.id:
                current_app.logger.error(f"ОКПО {new_okpo} уже существует у другой организации")
                send_delayed_response(user.id, "Ошибка: организация с таким ОКПО уже существует. Изменения не применены.", delay_seconds=2)
                return
            
            changes.append(f"ОКПО: '{organization.okpo}' → '{new_okpo}'")
            organization.okpo = new_okpo.strip()
        
        if new_ynp and new_ynp.strip() and new_ynp != organization.ynp:
            is_valid, error_msg = validate_ynp(new_ynp)
            if not is_valid:
                current_app.logger.error(f"Неверный УНП: {error_msg}")
                send_delayed_response(user.id, f"Ошибка: {error_msg}. Изменения не применены.", delay_seconds=2)
                return
            
            changes.append(f"УНП: '{organization.ynp}' → '{new_ynp}'")
            organization.ynp = new_ynp.strip()
        
        db.session.commit()
        
        # user_message = Message(
        #     text=f"Ваши данные организации были изменены:\n" + "\n".join(changes),
        #     recipient_id=user.id,
        # )
        # db.session.add(user_message)
        # db.session.commit()
        
        send_delayed_response(
            user.id,
            "Данные вашей организации успешно обновлены.",
            delay_seconds=2
        )
        
        # admins = User.query.filter_by(type="Администратор").all()
        # if admins:
        #     full_message = f"Изменены данные организации (ID: {organization_id})\n"
        #     full_message += "\n".join(changes)
        #     full_message += f"\n\nПользователь: {user.email}"
            
        #     for admin in admins:
        #         admin_message = Message(
        #             sender_id=user.id,
        #             text=full_message,
        #             recipient_id=admin.id
        #         )
        #         db.session.add(admin_message)
        #     db.session.commit()
        
        current_app.logger.debug(f"Данные организации ID {organization_id} были изменены.")
    
    thread = threading.Thread(target=update_task)
    thread.daemon = True
    thread.start()
    current_app.logger.info(f"Изменение организации ID {organization_id} запланировано через {delay_seconds} секунд.")
    return thread

def create_new_organization(organization_name, organization_okpo, organization_ynp, sender):
    new_message = Message(
        text=f"Ваше сообщение на добавление организации '{organization_name}' было отправлено.",
        recipient_id=current_user.id,
        create_time = current_utc_time()
    )
    db.session.add(new_message)
    db.session.commit()
    
    existing_org = Organization.query.filter_by(okpo=organization_okpo).first()
    if existing_org:
        current_app.logger.error("Такая организация уже существует.")
        send_delayed_response(
            sender.id, 
            "Ответ на ваше сообщение. Такая организация уже существует."
        )
        return existing_org
    
    new_organization = Organization(
        full_name=organization_name,
        okpo=organization_okpo,
        ynp=organization_ynp
    )
    db.session.add(new_organization)
    db.session.commit()
    
    send_delayed_response(
        sender.id, 
        "Ответ на ваше сообщение. Ваша организация была добавлена."
    )
    
    current_app.logger.debug(f"Организация '{organization_name}' была создана.")
    return new_organization