from flask import redirect, url_for
from flask_login import current_user
from flask_admin.contrib.sqla import ModelView
from website.models import DirUnit


class DirProductView(ModelView):
    column_display_pk = True

    column_labels = {
        'unit': 'Unit Code',
    }

    def _unit_formatter(view, context, model, name):
        return model.unit.CodeUnit if model.unit else 'N/A'

    column_formatters = {
        'unit': _unit_formatter,
    }

    column_searchable_list = ['CodeProduct', DirUnit.CodeUnit, 'NameProduct']

    def is_accessible(self):
        return current_user.is_authenticated and current_user.is_admin == True

    def inaccessible_callback(self, name, **kwargs):
        return redirect(url_for('views.login'))