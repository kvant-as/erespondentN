from flask_admin.contrib.sqla import ModelView
from flask import redirect, url_for
from flask_login import current_user
from wtforms import SelectField
from wtforms.validators import Optional
from wtforms_sqlalchemy.fields import QuerySelectField

from website.models import Ministry, Region

class OrganizationView(ModelView):
    column_display_pk = True
    
    column_list = [
        'id', 
        'full_name', 
        'okpo', 
        'ynp',
        'region', 
        'ministry',
        'is_active',
        'is_regular',
        'is_coordinator',
        'is_approver',
        'is_region_management'
    ]
    
    column_default_sort = ('full_name', True)
    
    column_sortable_list = ['id', 'full_name', 'okpo', 'ynp', 'region', 'ministry', 'is_active']
    
    column_searchable_list = ['full_name', 'okpo', 'ynp', 'id']
    
    column_filters = ['full_name', 'okpo', 'ynp', 'region', 'ministry', 'is_active']
    
    column_labels = {
        'id': 'ID',
        'full_name': 'Организация',
        'okpo': 'ОКПО',
        'ynp': 'УНП',
        'region': 'Регион',
        'ministry': 'Министерство',
        'is_active': 'Активна',
        'is_regular': 'Регулярная',
        'is_coordinator': 'Координатор',
        'is_approver': 'Утверждающий',
        'is_region_management': 'Упр. региона'
    }
    
    column_formatters = {
        'region': lambda view, context, model, name: model.region.name if model.region else '-',
        'ministry': lambda view, context, model, name: model.ministry.name if model.ministry else '-',
        'is_active': lambda view, context, model, name: '✅' if model.is_active else '❌',
        'is_regular': lambda view, context, model, name: '✅' if model.is_regular else '❌',
        'is_coordinator': lambda view, context, model, name: '✅' if model.is_coordinator else '❌',
        'is_approver': lambda view, context, model, name: '✅' if model.is_approver else '❌',
        'is_region_management': lambda view, context, model, name: '✅' if model.is_region_management else '❌'
    }
    
    column_editable_list = ['is_active', 'is_regular', 'is_coordinator', 'is_approver', 'is_region_management']
    
    form_columns = ['full_name', 'okpo', 'ynp', 'region', 'ministry', 'is_active', 'is_regular', 'is_coordinator', 'is_approver', 'is_region_management']
    
    can_export = True
    page_size = 50
    
    def scaffold_form(self):
        form_class = super(OrganizationView, self).scaffold_form()
        
        form_class.region = QuerySelectField(
            'Регион',
            query_factory=lambda: Region.query.order_by(Region.number).all(),
            get_label=lambda r: f"{r.number}. {r.name}",
            allow_blank=False
        )
        
        form_class.ministry = QuerySelectField(
            'Министерство',
            query_factory=lambda: Ministry.query.order_by(Ministry.name).all(),
            get_label=lambda m: m.name,
            allow_blank=True,
            blank_text='Не выбрано'
        )
        
        return form_class
    
    def is_accessible(self):
        return current_user.is_authenticated and current_user.is_admin == True

    def inaccessible_callback(self, name, **kwargs):
        return redirect(url_for('views.login'))