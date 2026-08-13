from datetime import datetime, timedelta
from pytz import timezone
import os
from urllib import request
from flask import Flask, flash, redirect, render_template, url_for, session, make_response
from flask_login import LoginManager
from flask_admin import Admin
from flask_sqlalchemy import SQLAlchemy
from flask_babel import Babel
from flask_migrate import Migrate
from flask_bcrypt import Bcrypt
from .database import create_database
from authlib.integrations.flask_client import OAuth
from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv
from website.logs import setup_logging

from flask_wtf.csrf import CSRFProtect

load_dotenv() 
db = SQLAlchemy()
babel = Babel()
migrate = Migrate()
csrf = CSRFProtect()
bcrypt = Bcrypt()
scheduler = BackgroundScheduler()

moscow_tz = timezone('Europe/Moscow')
scheduler = BackgroundScheduler()

def create_app():
    app = Flask(__name__, static_url_path='/static')

    # def delete_inactive_users():
    #     with app.app_context(): 
    #         expiration_time = datetime.utcnow() + timedelta(hours=3) - timedelta(days=365)
            
    #         inactive_users = User.query.filter(User.last_active < expiration_time).all()
    #         users_to_delete = [user for user in inactive_users if user.type not in ['Администратор', 'Аудитор']]
            
    #         for user in users_to_delete:
    #             db.session.delete(user)
    #             db.session.commit()
    #         print(f"Удалено {len(users_to_delete)} неактивных пользователей.")
    
    # scheduler.add_job(delete_inactive_users, 'cron', hour=0, minute=0, timezone=moscow_tz)
    # scheduler.start()

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
    
    # oauth = OAuth(app)
    # google = oauth.register(
    #     name='google',
    #     client_id=os.getenv('CLIENT_ID'),
    #     client_secret=os.getenv('CLIENT_SECRET'),
    #     server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    #     client_kwargs={'scope': 'openid profile email'}
    # )

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
    from .models import User, Organization, Report, Version_report, Ticket, DirUnit, DirProduct, Sections, Message, News, Region
    
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
 
    @app.template_filter('ru_date')
    def ru_date(date):
        months = {
            1: 'Января', 2: 'Февраля', 3: 'Марта',
            4: 'Апреля', 5: 'Мая', 6: 'Июня',
            7: 'Июля', 8: 'Августа', 9: 'Сентября',
            10: 'Октября', 11: 'Ноября', 12: 'Декабря'
        }
        return f"{date.day} {months[date.month]} {date.year}"
 
    # @app.context_processor
    # def inject_online_users():
    #     from datetime import datetime, timedelta
    #     from website.models import User
    #     from website.time import current_utc_time
        
    #     def get_online_count():
    #         try:
    #             five_minutes_ago = current_utc_time() - timedelta(minutes=5)
    #             return User.query.filter(User.last_active >= five_minutes_ago).count()
    #         except:
    #             return 0
        
    #     return dict(online_users_count=get_online_count())
 
    # @app.before_request
    # def update_last_active():
    #     from flask_login import current_user
    #     from website.time import current_utc_time
    #     # app.logger.info(f"before_request called, authenticated: {current_user.is_authenticated}")
        
    #     if current_user.is_authenticated:
    #         # app.logger.info(f"User {current_user.id} is authenticated, last_active: {current_user.last_active}")
            
    #         try:
    #             if current_user.last_active is None:
    #                 current_user.last_active = current_utc_time()
    #                 db.session.commit()
    #                 # app.logger.debug(f"Set initial last_active for user {current_user.id}")
    #             else:
    #                 time_diff = (current_utc_time() - current_user.last_active).total_seconds()
    #                 # app.logger.debug(f"Time diff for user {current_user.id}: {time_diff}s")
                    
    #                 if time_diff > 60:
    #                     current_user.last_active = current_utc_time()
    #                     db.session.commit()
    #                     # app.logger.debug(f"Updated last_active for user {current_user.id}")
    #                 # else:
    #                     # app.logger.debug(f"Skipped update for user {current_user.id}, diff={time_diff}s")
    #         except Exception as e:
    #             db.session.rollback()
    #             app.logger.error(f"Error updating last_active: {e}")
        # else:
        #     app.logger.info("User not authenticated")
    
    # @app.route('/login/google')
    # def login_google():
    #     try:
    #         redirect_uri = url_for('authorize_google', _external=True)
    #         return google.authorize_redirect(redirect_uri)
    #     except Exception as e:
    #         app.logger.error(f'Error during login: {str(e)}')
    #         return "Error occurred during login", 500

    # @app.route('/authorize/google')
    # def authorize_google():
    #     try:
    #         token = google.authorize_access_token()
    #         if not token:
    #             return "Authorization failed", 400
            
    #         userinfo_endpoint = google.server_metadata['userinfo_endpoint']
    #         resp = google.get(userinfo_endpoint)
    #         user_info = resp.json()

    #         if not user_info or 'email' not in user_info:
    #             return "Failed to retrieve user info", 400

    #         username = user_info['email']
    #         user = User.query.filter_by(email=username).first()

    #         if not user:
    #             user = User(email=username)
    #             db.session.add(user)
    #             db.session.commit()

    #         from flask_login import login_user 

    #         login_user(user, remember=True)

    #         from .sessions import create_user_session 
    #         session_token = create_user_session(user.id)

    #         session['username'] = username
    #         session['oauth_token'] = token

    #         response = redirect(url_for('views.profile'))
    #         response.set_cookie('session_token', session_token, httponly=True, samesite='Lax')

    #         flash('Добро пожаловать!', 'success')
    #         return response

    #     except Exception as e:
    #         app.logger.error(f'Error during authorization: {str(e)}')
    #         return "Error occurred during authorization", 500
        
    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))
    
    return app