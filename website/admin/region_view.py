from flask_admin.contrib.sqla import ModelView
from flask import redirect, url_for
from flask_login import current_user

from website.models import Region

class RegionView(ModelView):
    column_display_pk = True
    
    column_list = [
        'id',
        'number',
        'name',
        'organizations'
    ]
    
    column_default_sort = ('number', True)
    
    column_sortable_list = ['id', 'number', 'name']
    
    column_searchable_list = ['name', 'number']
    
    column_filters = ['id', 'number', 'name']
    
    column_labels = {
        'id': 'ID',
        'number': 'Номер региона',
        'name': 'Название региона',
        'organizations': 'Организации'
    }
    
    column_formatters = {
        'organizations': lambda view, context, model, name: len(model.organizations) if model.organizations else 0
    }
    
    form_columns = ['number', 'name']
    
    can_export = True
    page_size = 50
    
    def is_accessible(self):
        return current_user.is_authenticated and current_user.is_admin == True

    def inaccessible_callback(self, name, **kwargs):
        return redirect(url_for('views.login'))