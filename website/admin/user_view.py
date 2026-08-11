from flask_admin.contrib.sqla import ModelView
from wtforms.validators import Email
from werkzeug.security import generate_password_hash
from flask import redirect, url_for
from flask_login import current_user
from wtforms import PasswordField

from website.models import User

class UserView(ModelView):
    column_display_pk = True
    column_list = ['id', 'type', 'email', 'fio', 'telephone', 'organization', 'last_active', 'reports']
    column_default_sort = ('id', True)
    column_sortable_list = ('id', 'type', 'email', 'fio', 'telephone', 'last_active')
    
    can_delete = True
    can_create = True
    can_edit = True
    can_export = True
    
    export_max_rows = 500
    export_types = ['csv']
    
    form_args = {
        'email': dict(label='email', validators=[Email()]),
    }
    
    form_create_rules = ('type', 'email', 'fio', 'telephone', 'password', 'organization')
    form_edit_rules = ('type', 'email', 'fio', 'telephone', 'organization')
    
    AVAILABLE_USER_TYPES = [
        ('Респондент', 'Респондент'),
        ('Аудитор', 'Аудитор'),
        ('Администратор', 'Администратор'),
        ('Смотрящий', 'Смотрящий'),
    ]
    
    form_choices = {
        'type': AVAILABLE_USER_TYPES,
    }
    
    column_exclude_list = ['password']
    column_searchable_list = ['email', 'fio', 'telephone', 'id']
    column_filters = ['id', 'email', 'fio']
    column_editable_list = ['email', 'fio', 'type']
    
    create_modal = True
    edit_modal = True
    
    column_formatters = {
        'organization': lambda view, context, model, name: model.organization.full_name if model.organization else '-'
    }
    
    def scaffold_form(self):
        form_class = super(UserView, self).scaffold_form()
        form_class.password = PasswordField('Пароль', description='Введите пароль для нового пользователя')
        return form_class
    
    def on_model_change(self, view, model, is_created):
        if is_created:
            if model.password:
                model.password = generate_password_hash(model.password)
            else:
                model.password = generate_password_hash('')
        else:
            original = self.session.query(User).get(model.id)
            if original:
                model.password = original.password
        
    def is_accessible(self):
        return current_user.is_authenticated and current_user.type == "Администратор"

    def inaccessible_callback(self, name, **kwargs):
        return redirect(url_for('views.login'))