from datetime import timedelta
from pytz import timezone
import os
from urllib import request
from flask import Flask, redirect, render_template, url_for
from flask_login import LoginManager
from flask_admin import Admin
from flask_babel import Babel
from flask_migrate import Migrate
from flask_bcrypt import Bcrypt
from .database import create_database
from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv
from website.logs import setup_logging

from flask_wtf.csrf import CSRFProtect
from common_models.src import db

load_dotenv() 

babel = Babel()
migrate = Migrate()
csrf = CSRFProtect()
bcrypt = Bcrypt()
scheduler = BackgroundScheduler()

moscow_tz = timezone('Europe/Moscow')
scheduler = BackgroundScheduler()

def create_app():
    app = Flask(__name__, static_url_path='/static')

    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
    app.config['SESSION_TYPE'] = 'sqlalchemy'
    app.config['SESSION_SQLALCHEMY'] = db
    app.config['SESSION_PERMANENT'] = True
    app.config['FLASK_ADMIN_SWATCH'] = 'cosmo'
    app.config['BABEL_DEFAULT_LOCALE'] = 'ru'
    app.config['SQLALCHEMY_DATABASE_URI'] = f"postgresql://{os.getenv('postrgeuser')}:{os.getenv('postrgepass')}@localhost:5432/{os.getenv('postrgedbname')}"
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)
    app.config['TESTING'] = False
    
    db.init_app(app)
    babel.init_app(app)
    bcrypt.init_app(app)
    migrate.init_app(app, db, render_as_batch=True)
    csrf.init_app(app) 
       
    setup_logging(app)
    
    from .routes.views import views
    from .routes.auth import auth
    from .routes.dbs import dbs
    from .routes.api import api

    app.register_blueprint(views, url_prefix='/')
    app.register_blueprint(auth, url_prefix='/')
    app.register_blueprint(dbs, url_prefix='/')
    app.register_blueprint(api, url_prefix='/api')

    with app.app_context():
        create_database(app, db)
    
    from website.admin.admin_views import MyMainView
    from common_models.src import (
        User, Organization, Region,
        Message, Report, Version_report, Ticket,
        DirUnit, DirProduct, Sections, News
    )
    
    from website.admin.user_view import UserView
    from website.admin.organization_view import OrganizationView
    from website.admin.report_view import ReportView
    from website.admin.version_report_view import Version_reportView
    from website.admin.ticket_view import TicketView
    from website.admin.dirUnit_view import DirUnitView
    from website.admin.dirProduct_view import DirProductView
    from website.admin.sections_view import SectionsView
    from website.admin.message_view import MessageView
    from website.admin.news_view import NewsView
    from website.admin.region_view import RegionView
    
    admin = Admin(app, 'Вернуться', index_view=MyMainView(), template_mode='bootstrap4', url='/profile')
    admin.add_view(UserView(User, db.session))
    admin.add_view(OrganizationView(Organization, db.session))
    admin.add_view(ReportView(Report, db.session))
    admin.add_view(Version_reportView(Version_report, db.session))
    admin.add_view(TicketView(Ticket, db.session))
    admin.add_view(DirUnitView(DirUnit, db.session))
    admin.add_view(DirProductView(DirProduct, db.session))
    admin.add_view(SectionsView(Sections, db.session))
    admin.add_view(MessageView(Message, db.session)) 
    admin.add_view(NewsView(News, db.session)) 
    admin.add_view(RegionView(Region, db.session)) 

    login_manager = LoginManager()
    login_manager.login_view = 'auth.login'
    login_manager.init_app(app)
    login_manager.login_message = "Пожалуйста, авторизуйтесь для доступа к этой странице."
    login_manager.login_view = "views.login"
    
    @app.errorhandler(404)
    def page_not_found(e):
        return render_template('404.html'), 404
    
    @app.errorhandler(401)
    def unauthorized_handler(error):
        return redirect(url_for("views.login", next=request.url))
 
    @app.context_processor
    def inject_session_timer():
        from website.sessions import get_session_time_left
        info = get_session_time_left()
        # session_required реально разлогинивает по истечении тайм-аута
        # (в т.ч. в debug-режиме), поэтому таймер в шапке всегда должен
        # перезагружать страницу по нулю.
        session_enforced = True
        if info is None:
            return dict(session_seconds_left=None, session_timeout_seconds=None, session_enforced=session_enforced)
        seconds_left, timeout_seconds = info
        return dict(session_seconds_left=seconds_left, session_timeout_seconds=timeout_seconds, session_enforced=session_enforced)

    @app.template_filter('ru_date')
    def ru_date(date):
        months = {
            1: 'Января', 2: 'Февраля', 3: 'Марта',
            4: 'Апреля', 5: 'Мая', 6: 'Июня',
            7: 'Июля', 8: 'Августа', 9: 'Сентября',
            10: 'Октября', 11: 'Ноября', 12: 'Декабря'
        }
        return f"{date.day} {months[date.month]} {date.year}"
 
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    common_templates = os.path.join(project_root, 'common_models', 'templates')
    
    app.jinja_loader.searchpath = [
        os.path.join(app.root_path, 'templates'),
        common_templates
    ]
 
    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))
    
    return app