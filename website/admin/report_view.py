from flask_admin.contrib.sqla import ModelView
from flask import redirect, url_for
from flask_login import current_user

class ReportView(ModelView):
    column_display_pk = True
    can_delete = True
    can_create = True
    can_edit = True
    can_export = True
    column_list = ['id', 'org_id', 'year', 'quarter', 'user_id', 'versions']
    
    column_searchable_list = ['org_id', 'id']

    def is_accessible(self):
        return current_user.is_authenticated and current_user.is_admin == True

    def inaccessible_callback(self, name, **kwargs):
        return redirect(url_for('views.login'))

   