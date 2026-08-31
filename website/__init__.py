import os
from datetime import timedelta
from importlib.resources import files

from flask import Flask, redirect, render_template, request, url_for
from flask_login import LoginManager
from flask_babel import Babel
from flask_migrate import Migrate
from flask_bcrypt import Bcrypt
from flask_wtf.csrf import CSRFProtect
from dotenv import load_dotenv

from common_models import db
from common_models.logs import setup_logging

load_dotenv()

babel = Babel()
migrate = Migrate()
csrf = CSRFProtect()
bcrypt = Bcrypt()


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
    app.config['APP_NAME'] = os.getenv('APP_NAME', 'erespondentn')

    app.config['LOG_LEVEL'] = os.getenv('LOG_LEVEL', 'INFO')
    app.config['LOG_JSON'] = os.getenv('LOG_JSON')
    app.config['LOG_STATIC_REQUESTS'] = os.getenv('LOG_STATIC_REQUESTS')
    app.config['LOG_TO_FILE'] = os.getenv('LOG_TO_FILE')
    app.config['LOG_DIR'] = os.getenv('LOG_DIR', 'logs')
    app.config['LOG_FILE'] = os.getenv('LOG_FILE', 'erespondentn.json')

    # common_models.sessions
    app.config['SESSION_TOKEN_COOKIE'] = 'erespondent_session'
    app.config['SESSION_TIMEOUT_DEFAULT'] = timedelta(minutes=30)
    app.config['SESSION_PRIVILEGED_ATTRS'] = ('is_admin', 'is_auditor')
    app.config['SESSION_DEFAULT_REDIRECT'] = 'views.profile'
    app.config['SESSION_ENFORCE_IN_DEBUG'] = True

    db.init_app(app)
    babel.init_app(app)
    bcrypt.init_app(app)
    migrate.init_app(app, db,
                     directory=str(files('common_models') / 'migrations'),
                     render_as_batch=True)
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

    # schema is managed by Alembic (common_models/migrations); run `flask db upgrade`

    from .admin import init_admin
    init_admin(app)

    from common_models.session_ui import init_session_ui
    init_session_ui(app)

    from common_models.forms_ui import init_forms_ui
    init_forms_ui(app)

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
 
    @app.template_filter('ru_date')
    def ru_date(date):
        months = {
            1: 'Января', 2: 'Февраля', 3: 'Марта',
            4: 'Апреля', 5: 'Мая', 6: 'Июня',
            7: 'Июля', 8: 'Августа', 9: 'Сентября',
            10: 'Октября', 11: 'Ноября', 12: 'Декабря'
        }
        return f"{date.day} {months[date.month]} {date.year}"
 
    common_templates = str(files('common_models') / 'templates')

    app.jinja_loader.searchpath = [
        os.path.join(app.root_path, 'templates'),
        common_templates
    ]
 
    @login_manager.user_loader
    def load_user(user_id):
        from common_models import User
        return User.query.get(int(user_id))
    
    return app