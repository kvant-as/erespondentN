from flask_admin import AdminIndexView, expose
from flask_login import current_user
from ..models import User, Organization, Report, Version_report, Ticket, DirUnit, DirProduct, Sections
from sqlalchemy.exc import SQLAlchemyError
from flask_admin.contrib.sqla import ModelView
from flask import flash, redirect, request, url_for
from functools import wraps

def admin_only(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if current_user.is_admin == False:
            flash('Недостаточно прав для доступа', 'error')
            return redirect(url_for('views.beginPage'))   
        return f(*args, **kwargs)
    return decorated_function

class MyMainView(AdminIndexView):
    @expose('/')
    def admin_stats(self):
        if not current_user.is_authenticated:
            return redirect(url_for('auth.login')) 

        if not self.is_accessible():
            return redirect(request.referrer)

        try:
            user_data = User.query.count()
            dirUnit_data = DirUnit.query.count()
            organization_data = Organization.query.count()
            report_data = Report.query.count()
            version_report_data = Version_report.query.count()
            dirProduct_data = DirProduct.query.count()
            sections_data = Sections.query.count()
            ticket_data = Ticket.query.count()

        except SQLAlchemyError:
            user_data = dirUnit_data = organization_data = report_data = version_report_data = dirProduct_data = sections_data = ticket_data = 0

        return self.render('admin/stats.html', 
                        user_data=user_data,
                        dirUnit_data=dirUnit_data,
                        organization_data=organization_data,
                        report_data=report_data,
                        version_report_data=version_report_data,
                        dirProduct_data=dirProduct_data,
                        sections_data=sections_data,
                        ticket_data=ticket_data
                           )

    def is_accessible(self):
        return current_user.is_authenticated and current_user.is_admin

    def inaccessible_callback(self, name, **kwargs):
        if not current_user.is_authenticated:
            return redirect(url_for('auth.login'))
        return redirect(request.referrer)

class BaseAdminView(ModelView):
    def is_accessible(self):
        return current_user.is_authenticated and current_user.is_admin

    def inaccessible_callback(self, name, **kwargs):
        return redirect(url_for('auth.login'))
