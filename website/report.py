from decimal import Decimal, InvalidOperation

from flask import redirect, flash, request, url_for
from flask_login import current_user
# from .email import send_email

from sqlalchemy import and_, or_
from sqlalchemy.sql import func, or_
import math

from website.time import current_utc_time
from .models import Organization, Report, Sections, Version_report
from . import db

def to_decimal(value):
    if not value and value != 0:
        return Decimal('0.00')
    try:
        if isinstance(value, Decimal):
            return value
        if isinstance(value, (int, float)):
            return Decimal(str(value))
        cleaned = str(value).replace(',', '.').strip()
        return Decimal(cleaned)
    except (ValueError, InvalidOperation, TypeError, AttributeError):
        return Decimal('0.00')

def check_version_editable(version):
    if not version:
        flash('Версия не найдена.', 'error')
        return False
    if version.status in ('Отправлен', 'Одобрен'):
        flash('Редактирование отправленного/одобренного отчета недоступно.', 'error')
        return False
    return True

def update_version_status(version):
    if version:
        version.change_time = current_utc_time()
        version.status = "Заполнение"
        db.session.commit()

def create_section(data, product_id, code_product):
    return Sections(
        id_version=data['current_version_id'],
        id_product=product_id,
        code_product=code_product,
        section_number=data['section_number'],
        Oked=data['oked'],
        produced=data['produced'],
        Consumed_Quota=data['Consumed_Quota'],
        Consumed_Fact=data['Consumed_Fact'],
        Consumed_Total_Quota=data['Consumed_Total_Quota'],
        Consumed_Total_Fact=data['Consumed_Total_Fact'],
        total_differents=None,
        note=data['note']
    )

def calculate_consumed_fact(section, product_unit):
    if section.produced == 0:
        return 0
    if product_unit and product_unit.NameUnit in ('%', '% (включая покупную)'):
        return round((section.Consumed_Total_Fact / section.produced) * 100, 2)
    return round((section.Consumed_Total_Fact / section.produced) * 1000, 2)

def calculate_total_quota(section, product_unit):
    if section.Consumed_Quota == 0:
        return 0
    if product_unit and product_unit.NameUnit in ('%', '% (включая покупную)'):
        return round((section.produced * section.Consumed_Quota) / 100, 2)
    return round((section.produced * section.Consumed_Quota) / 1000, 2)

def process_section_calculations(section, product_unit):
    try:
        if section.produced != 0:
            section.Consumed_Fact = calculate_consumed_fact(section, product_unit)
        else:
            section.Consumed_Fact = 0
        
        section.Consumed_Total_Quota = calculate_total_quota(section, product_unit)
        section.total_differents = section.Consumed_Total_Fact - section.Consumed_Total_Quota
        db.session.commit()
    except InvalidOperation as e:
        flash(f"Ошибка при вычислениях: {e}")

def update_aggregated_sections(version_id, section_number):
    specific_codes = ['9001', '9010', '9100']
    
    section9001 = Sections.query.filter_by(
        id_version=version_id, section_number=section_number, code_product='9001'
    ).first()
    
    aggregated = db.session.query(
        func.sum(Sections.Consumed_Total_Quota),
        func.sum(Sections.Consumed_Total_Fact),
        func.sum(Sections.total_differents)
    ).filter(
        Sections.id_version == version_id,
        Sections.section_number == section_number,
        ~Sections.code_product.in_(specific_codes)
    ).first()
    
    if section9001 and aggregated:
        section9001.Consumed_Total_Quota = aggregated[0] or 0
        section9001.Consumed_Total_Fact = aggregated[1] or 0
        section9001.total_differents = aggregated[2] or 0
    
    section9010 = Sections.query.filter_by(
        id_version=version_id, section_number=section_number, code_product='9010'
    ).first()
    section9100 = Sections.query.filter_by(
        id_version=version_id, section_number=section_number, code_product='9100'
    ).first()
    
    if section9100 and section9001 and section9010:
        section9100.Consumed_Total_Quota = section9001.Consumed_Total_Quota + section9010.Consumed_Total_Quota
        section9100.Consumed_Total_Fact = section9001.Consumed_Total_Fact + section9010.Consumed_Total_Fact
        section9100.total_differents = section9001.total_differents + section9010.total_differents
    
    db.session.commit()

def update_section_fields(section, form, product_unit):
    if section.product.CodeProduct == "7000":
        section.Consumed_Total_Quota = to_decimal(form.get('Consumed_Total_Quota_change'))
        section.Consumed_Total_Fact = to_decimal(form.get('Consumed_Total_Fact_change'))
        section.note = form.get('note_change')
        db.session.commit()
        section.total_differents = section.Consumed_Total_Fact - section.Consumed_Total_Quota
    else:
        section.produced = to_decimal(form.get('produced_change'))
        section.Consumed_Quota = to_decimal(form.get('Consumed_Quota_change'))
        section.Consumed_Total_Fact = to_decimal(form.get('Consumed_Total_Fact_change'))
        section.note = form.get('note_change')
        db.session.commit()
        process_section_calculations(section, product_unit)
    db.session.commit()

def subtract_from_aggregated_sections(section):
    for code in ['9001', '9100']:
        agg_section = Sections.query.filter_by(
            id_version=section.id_version,
            section_number=section.section_number,
            code_product=code
        ).first()
        
        if agg_section:
            agg_section.Consumed_Total_Quota -= section.Consumed_Total_Quota
            agg_section.Consumed_Total_Fact -= section.Consumed_Total_Fact
            agg_section.total_differents -= section.total_differents
    
    db.session.commit()

def redirect_back(version, section_number=None):
    if section_number:
        report_type_map = {1: 'fuel', 2: 'heat', 3: 'electro'}
        report_type = report_type_map.get(section_number)
        if report_type:
            return redirect(url_for('views.report_section', report_type=report_type, id=version.id))
    return redirect(request.referrer)











def cancel_sending(id):
    current_version = Version_report.query.filter_by(id=id).first()
    if current_version.status == 'Отправлен':
        current_version.status = 'Заполнение'
        db.session.commit()
        flash('Отправка отчета была отменена! Новый статус отчета - "Заполнение".', 'succes')
    else:
        flash('Отменить можно только непросмотренный отчет!', 'error')
    return redirect(request.referrer)

SPECIAL_OKPO_LISTS = { # убрать откуда номер региона : ['ОКПО']        
    6: ['030662355000'],
    6: ['020133895000'],
    5: ['305144986000'],
}

EXCLUDED_OKPO_LISTS = { # добавить куда номер региона : ['ОКПО']
    5: ['030662355000'],
    5: ['020133895000'],
    6: ['305144986000']
}

def get_reports_by_status(status, year=None, quarter=None, region=None):
    def translate_status(status):
        status_map = {
            'not_viewed': 'Отправлен',
            'remarks': 'Есть замечания',
            'to_download': 'Одобрен',
            'to_delete': 'Готов к удалению'
        }
        return status_map.get(status)

    filters = []
    statuses = [
        'Отправлен',
        'Есть замечания',
        'Одобрен',
        'Готов к удалению'
    ]
    
    if year:
        filters.append(Report.year == year)
    if quarter:
        filters.append(Report.quarter == quarter)
    
    user_type = current_user.type
    okpo_digit = str(current_user.organization.okpo)[0]

    special_condition = False
    if okpo_digit.isdigit() and int(okpo_digit) in SPECIAL_OKPO_LISTS:
        special_condition = True
    
    excluded_condition = False
    if okpo_digit.isdigit() and int(okpo_digit) in EXCLUDED_OKPO_LISTS:
        excluded_condition = True

    # Базовый фильтр по региону из выпадающего списка
    region_filter = None
    if region and region.isdigit():
        region_filter = region

    if user_type == "Администратор" or user_type == "Смотрящий":
        base_query = Report.query.join(Version_report)
        
        if region_filter:
            base_query = base_query.join(Organization).filter(
                func.substr(Organization.okpo, func.length(Organization.okpo) - 3, 1) == region_filter
            )
        
        if status == 'all_reports':
            query = base_query.filter(
                or_(*[Version_report.status == s for s in statuses]),
                *filters
            )
        else:
            trans_status = translate_status(status)
            if trans_status:
                query = base_query.filter(
                    Version_report.status == trans_status,
                    *filters
                )
            else:
                return []
        return query.order_by().all()
    
    else:
        if status == 'all_reports':
            query = Report.query.join(Version_report).join(Organization)
            
            # Добавляем региональный фильтр если он есть
            if region_filter:
                query = query.filter(
                    func.substr(Organization.okpo, func.length(Organization.okpo) - 3, 1) == region_filter
                )
            
            if special_condition and excluded_condition:
                return query.filter(
                    or_(
                        and_(
                            or_(*[Version_report.status == s for s in statuses]),
                            func.substr(Organization.okpo, func.length(Organization.okpo) - 3, 1) == okpo_digit
                        ),
                        and_(
                            or_(*[Version_report.status == s for s in statuses]),
                            Organization.okpo.in_(SPECIAL_OKPO_LISTS[int(okpo_digit)])
                        )
                    ),
                    ~Organization.okpo.in_(EXCLUDED_OKPO_LISTS[int(okpo_digit)]),
                    *filters
                ).order_by().all()
            elif special_condition:
                return query.filter(
                    or_(
                        and_(
                            or_(*[Version_report.status == s for s in statuses]),
                            func.substr(Organization.okpo, func.length(Organization.okpo) - 3, 1) == okpo_digit
                        ),
                        and_(
                            or_(*[Version_report.status == s for s in statuses]),
                            Organization.okpo.in_(SPECIAL_OKPO_LISTS[int(okpo_digit)])
                        )
                    ),
                    *filters
                ).order_by().all()
            elif excluded_condition:
                return query.filter(
                    or_(*[Version_report.status == s for s in statuses]),
                    *filters,
                    func.substr(Organization.okpo, func.length(Organization.okpo) - 3, 1) == okpo_digit,
                    ~Organization.okpo.in_(EXCLUDED_OKPO_LISTS[int(okpo_digit)])
                ).order_by().all()
            else:
                return query.filter(
                    or_(*[Version_report.status == s for s in statuses]),
                    *filters,
                    func.substr(Organization.okpo, func.length(Organization.okpo) - 3, 1) == okpo_digit
                ).order_by().all()
        else:
            trans_status = translate_status(status)
            if trans_status:
                query = Report.query.join(Version_report).join(Organization)
                
                # Добавляем региональный фильтр если он есть
                if region_filter:
                    query = query.filter(
                        func.substr(Organization.okpo, func.length(Organization.okpo) - 3, 1) == region_filter
                    )
                
                if special_condition and excluded_condition:
                    return query.filter(
                        or_(
                            and_(
                                Version_report.status == trans_status,
                                func.substr(Organization.okpo, func.length(Organization.okpo) - 3, 1) == okpo_digit
                            ),
                            and_(
                                Version_report.status == trans_status,
                                Organization.okpo.in_(SPECIAL_OKPO_LISTS[int(okpo_digit)])
                            )
                        ),
                        ~Organization.okpo.in_(EXCLUDED_OKPO_LISTS[int(okpo_digit)]),
                        *filters
                    ).order_by().all()
                elif special_condition:
                    return query.filter(
                        or_(
                            and_(
                                Version_report.status == trans_status,
                                func.substr(Organization.okpo, func.length(Organization.okpo) - 3, 1) == okpo_digit
                            ),
                            and_(
                                Version_report.status == trans_status,
                                Organization.okpo.in_(SPECIAL_OKPO_LISTS[int(okpo_digit)])
                            )
                        ),
                        *filters
                    ).order_by().all()
                elif excluded_condition:
                    return query.filter(
                        Version_report.status == trans_status,
                        *filters,
                        func.substr(Organization.okpo, func.length(Organization.okpo) - 3, 1) == okpo_digit,
                        ~Organization.okpo.in_(EXCLUDED_OKPO_LISTS[int(okpo_digit)])
                    ).order_by().all()
                else:
                    return query.filter(
                        Version_report.status == trans_status,
                        *filters,
                        func.substr(Organization.okpo, func.length(Organization.okpo) - 3, 1) == okpo_digit
                    ).order_by().all()
            else:
                return []