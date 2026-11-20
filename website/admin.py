"""ErespondentN admin — описание моделей для движка eres-admin."""

from werkzeug.security import generate_password_hash

from eres_admin import AdminSite, Field as F
from common_models import (
    db, current_utc_time, count_online, get_current_application_id,
    org_accounts_cell, org_egr_state_display, org_egr_refresh,
    User, Application, UserAppActivity, UserAppDailyActivity, Organization, Region, Ministry, News,
    Report, Version_report, Ticket, DirUnit, DirProduct, Sections, Message,
)

site = AdminSite(
    brand="ErespondentN",
    db=db,
    code="erespondentn",
    site_endpoint="views.beginPage",
    login_endpoint="views.login",
    logout_endpoint="auth.logout",
    now=current_utc_time,
)

site.link("Сообщения администратору", "admin_messages.list_view", group="Обращения", icon="message")


def _scope_to_this_app(query):
    """Аккаунты теперь привязаны к конкретному приложению — админка
    erespondentN должна видеть/создавать только свои (иначе тут же
    путается с enPlans-аккаунтами того же человека)."""
    return query.filter(User.application_id == get_current_application_id())


def _user_app_activity_scope(query):
    return query.filter(UserAppActivity.app == "erespondentn")


def _user_on_save(obj, creating):
    """Новый аккаунт из админки всегда создаётся для ЭТОГО приложения —
    поле application_id нарочно не редактируется через форму (см. ниже,
    readonly), значение всегда берётся отсюда, а не из формы."""
    if creating:
        obj.application_id = get_current_application_id()
        # Без пароля в аккаунт нельзя войти — при создании он обязателен
        # (поле пароля в форме skip_if_blank: пустое значение не меняет пароль).
        if not obj.password:
            raise ValueError('Задайте пароль: без него пользователь не сможет войти')


def _user_auditor_display(obj):
    if obj.is_region_auditor:
        return f"Да — {obj.organization.short_name or obj.organization.full_name}"
    return "Нет"


def _user_application_display(obj):
    return obj.application.name if obj.application else "—"




def _news_on_save(obj, creating):
    """Держим published_at в синхроне с галочкой «Опубликовано»."""
    from common_models import current_utc_time
    if creating:
        obj.application_id = get_current_application_id()
    if getattr(obj, "is_published", False):
        if not obj.published_at:
            obj.published_at = current_utc_time()
    else:
        obj.published_at = None


def _news_scope_to_this_app(query):
    """Новость принадлежит одному приложению — админка видит только свои."""
    return query.filter(News.application_id == get_current_application_id())


# --------------------------------------------------------------------------- #
#  Основные
# --------------------------------------------------------------------------- #

site.register(
    User, name="Пользователи", group="Основные", stat_label="Пользователей",
    list_display=["id", "email", "organization", "begin_time"],
    list_badges=["is_admin", "is_region_auditor", "is_reader"],
    search=["email", "last_name", "first_name", "telephone"],
    scope_query=_scope_to_this_app,
    on_save=_user_on_save,
    fields=[
        F("email", "Email", type="email", required=True),
        F("last_name", "Фамилия"), F("first_name", "Имя"), F("patronymic_name", "Отчество"),
        F("telephone", "Телефон"), F("post", "Должность"),
        F("is_admin", "Администратор", type="bool"),
        F("is_reader", "Читатель", type="bool"),
        F("is_region_auditor", "Аудитор", readonly=True, display=_user_auditor_display,
          help="Не редактируется: аудитором становится аккаунт регионального управления по надзору — "
               "для этого выберите такую организацию в поле «Организация»."),
        F("organization_id", "Организация", type="fk-search", target=Organization, target_label="full_name"),
        F("application_id", "Приложение", readonly=True, display=_user_application_display,
          help="Аккаунт создаётся только для текущего приложения (ErespondentN) — не редактируется."),
        F("password", "Пароль", type="password", skip_if_blank=True,
          transform=generate_password_hash,
          help="Сохраняется в зашифрованном виде. При создании обязателен; при редактировании оставьте пустым, чтобы не менять."),
    ],
)

site.register(
    Application, name="Приложения", group="Основные",
    list_display=["id", "code", "name"], search=["code", "name"], order_by="code",
    fields=[
        F("code", "Код (APP_NAME)", required=True),
        F("name", "Название", required=True),
    ],
)

site.register(
    Organization, name="Организации", group="Основные", stat_label="Организаций",
    list_display=["id", "full_name", "okpo", "region", "ministry", ("accounts", "Пользователи")],
    list_badges=["is_active", "is_regular", "is_coordinator", "is_approver", "is_region_management"],
    list_format={"accounts": org_accounts_cell},
    search=["full_name", "short_name", "okpo", "ynp"],
    fields=[
        F("full_name", "Полное наименование", type="text", rows=2, required=True),
        F("short_name", "Сокращённое наименование"),
        F("okpo", "ОКПО"), F("ynp", "УНП"),
        F("legal_address", "Юридический адрес", type="text", rows=2),
        F("region_id", "Регион", type="fk", target=Region, target_label="name"),
        F("ministry_id", "Министерство", type="fk", target=Ministry, target_label="name"),
        F("is_active", "Активна", type="bool", section="Роль в системе"),
        F("is_regular", "Обычная", type="bool", section="Роль в системе"),
        F("is_coordinator", "Координатор", type="bool", section="Роль в системе"),
        F("is_approver", "Утверждающая", type="bool", section="Роль в системе"),
        F("is_region_management", "Региональное управление", type="bool", section="Роль в системе"),
        F("is_energy_department", "Департамент по энергоэффективности", type="bool", section="Роль в системе"),
        F("egr_status", "Статус в ЕГР", readonly=True, section="Данные ЕГР"),
        F("egr_status_kind", "Состояние", readonly=True, display=org_egr_state_display, section="Данные ЕГР"),
        F("egr_checked_at", "Последняя сверка с ЕГР", readonly=True, section="Данные ЕГР"),
        F("created_at", "Добавлена в систему", readonly=True, section="Данные ЕГР"),
    ],
    object_actions=[{
        "name": "egr-refresh", "label": "Обновить из ЕГР", "icon": "refresh", "handler": org_egr_refresh,
        "confirm": "Обновить наименования, юридический адрес, регион и статус организации по данным ЕГР?",
        "help": "По УНП: полное и сокращённое наименование, юридический адрес, регион и статус.",
    }],
)

site.register(
    Region, name="Регионы", group="Основные",
    list_display=["id", "number", "name"], search=["name"], order_by="number",
    fields=[F("number", "Номер", type="int", required=True), F("name", "Название", required=True)],
)

site.register(
    News, name="Новости", group="Основные", stat_label="Новостей",
    list_display=["id", "title", "created_time", "views_count"],
    list_badges=["is_published"],
    search=["title", "text"],
    scope_query=_news_scope_to_this_app,
    on_save=_news_on_save,
    fields=[
        F("title", "Заголовок", required=True),
        F("text", "Текст", type="text", rows=8),
        F("img_name", "Картинка (обложка)", type="file",
          upload_to="static/img/news", accept="image/*"),
        F("is_published", "Опубликовано", type="bool", default=True,
          help="Снимите галочку, чтобы скрыть новость с сайта"),
        F("application_id", "Приложение", readonly=True, display=_user_application_display,
          help="Новость создаётся только для текущего приложения (ErespondentN) — не редактируется."),
        F("views_count", "Просмотры", type="int"),
    ],
)

# --------------------------------------------------------------------------- #
#  Отчёты
# --------------------------------------------------------------------------- #

site.register(
    Report, name="Отчёты", group="Отчёты", stat_label="Отчётов",
    list_display=["id", "organization", "year", "quarter", "user"], order_by="-id",
    fields=[
        F("org_id", "Организация", type="fk", target=Organization, target_label="full_name"),
        F("user_id", "Пользователь", type="fk-search", target=User, target_label="email"),
        F("year", "Год", type="int"),
        F("quarter", "Квартал", type="int"),
    ],
)

site.register(
    Version_report, name="Версии отчётов", group="Отчёты",
    list_display=["id", "report_id", "status", "begin_time", "sent_time"],
    list_badges=["hasNot"], search=["status"], order_by="-id",
    fields=[
        F("report_id", "Отчёт", type="fk", target=Report, target_label="id", required=True),
        F("status", "Статус"),
        F("hasNot", "Нет данных", type="bool"),
        F("change_time", "Изменён", type="datetime"),
        F("sent_time", "Отправлен", type="datetime"),
        F("audit_time", "Проверен", type="datetime"),
    ],
)

site.register(
    Ticket, name="Тикеты", group="Отчёты", stat_label="Тикетов",
    list_display=["id", "version_report_id", "begin_time", "note"],
    list_badges=["luck"], order_by="-id",
    fields=[
        F("version_report_id", "Версия отчёта", type="fk", target=Version_report,
          target_label="id", required=True),
        F("note", "Текст", type="text"),
        F("begin_time", "Время", type="datetime"),
        F("luck", "Успех", type="bool"),
    ],
)

site.register(
    Sections, name="Разделы отчётов", group="Отчёты",
    list_display=["id", "id_version", "code_product", "section_number", "note"],
    search=["code_product", "Oked", "note"], order_by="-id", per_page=50,
    fields=[
        F("id_version", "Версия отчёта", type="fk", target=Version_report, target_label="id"),
        F("id_product", "Продукт", type="fk", target=DirProduct, target_label="NameProduct"),
        F("code_product", "Код продукта"),
        F("section_number", "Номер раздела", type="int"),
        F("Oked", "ОКЭД"),
        F("produced", "Произведено", type="float"),
        F("Consumed_Quota", "Потреблено (квота)", type="float"),
        F("Consumed_Fact", "Потреблено (факт)", type="float"),
        F("Consumed_Total_Quota", "Итого потреблено (квота)", type="float"),
        F("Consumed_Total_Fact", "Итого потреблено (факт)", type="float"),
        F("total_differents", "Отклонение", type="float"),
        F("note", "Примечание"),
    ],
)

# --------------------------------------------------------------------------- #
#  Справочники
# --------------------------------------------------------------------------- #

site.register(
    DirUnit, name="Единицы измерения", group="Справочники", key="dir-unit",
    list_display=["IdUnit", "CodeUnit", "NameUnit"], search=["CodeUnit", "NameUnit"],
    order_by="CodeUnit",
    fields=[F("CodeUnit", "Код", required=True), F("NameUnit", "Название", required=True)],
)

site.register(
    DirProduct, name="Продукция", group="Справочники", key="dir-product",
    list_display=["id", "CodeProduct", "NameProduct", "unit"],
    list_badges=["IsFuel", "IsHeat", "IsElectro"],
    search=["CodeProduct", "NameProduct"], order_by="CodeProduct",
    fields=[
        F("CodeProduct", "Код", required=True),
        F("NameProduct", "Название", required=True),
        F("IdUnit", "Единица измерения", type="fk", target=DirUnit, target_label="CodeUnit"),
        F("IsFuel", "Топливо", type="bool"),
        F("IsHeat", "Тепло", type="bool"),
        F("IsElectro", "Электроэнергия", type="bool"),
        F("DateStart", "Действует с", type="datetime"),
        F("DateEnd", "Действует по", type="datetime"),
    ],
)

# --------------------------------------------------------------------------- #
#  Обращения / служебные
# --------------------------------------------------------------------------- #

site.register(
    Message, name="Сообщения", group="Обращения", stat_label="Сообщений",
    list_display=["id", "sender", "recipient", "text", "create_time"],
    list_badges=["to_admin", "is_read"], search=["text"], order_by="-id", per_page=50,
    fields=[
        F("sender_id", "Отправитель", type="fk-search", target=User, target_label="email"),
        F("recipient_id", "Получатель", type="fk-search", target=User, target_label="email"),
        F("text", "Текст", type="text", required=True),
        F("to_admin", "Администратору", type="bool"),
        F("is_read", "Прочитано", type="bool"),
        F("read_time", "Прочитано в", type="datetime"),
    ],
)

site.register(
    UserAppActivity, name="Активность по приложениям", group="Служебные",
    readonly=True, order_by="-last_active", per_page=50,
    list_display=["id", "user", "app", "first_seen", "last_active"],
    search=["app"],
    scope_query=_user_app_activity_scope,
)

# --------------------------------------------------------------------------- #

def _version_status_rows():
    rows = (
        db.session.query(Version_report.status, db.func.count(Version_report.id))
        .group_by(Version_report.status)
        .order_by(db.func.count(Version_report.id).desc())
        .limit(6)
        .all()
    )
    return [(status or "Без статуса", n) for status, n in rows]


def _report_year_rows():
    rows = (
        db.session.query(Report.year, db.func.count(Report.id))
        .filter(Report.year.isnot(None))
        .group_by(Report.year)
        .order_by(Report.year.desc())
        .limit(5)
        .all()
    )
    return [(f"{year} год", n) for year, n in rows]


def _daily_activity_scope(query):
    return query.filter(UserAppDailyActivity.app == "erespondentn")


site.register(
    UserAppDailyActivity, name="Активность по дням", group="Служебные", key="user-app-daily-activity",
    readonly=True, order_by="-day", per_page=50,
    list_display=["day", "user", ("ticks", "Минут в приложении"), "first_at", "last_at"],
    scope_query=_daily_activity_scope,
)

site.dashboard(
    greeting_attr="first_name",
    stats=["news", "report", "organization", "user"],
    online_count=lambda: count_online("erespondentn"),
    charts=[
        {"title": "Активные пользователи", "model": UserAppDailyActivity, "date_attr": "day",
         "distinct": "user_id", "scope": _daily_activity_scope},
        {"title": "Отправленные отчёты", "model": Version_report, "date_attr": "sent_time"},
        {"title": "Новые пользователи", "model": User, "date_attr": "begin_time", "scope": _scope_to_this_app},
        {"title": "Сообщения", "model": Message, "date_attr": "create_time"},
    ],
    breakdowns=[
        {"title": "Версии отчётов по статусам", "rows": _version_status_rows, "icon": "layers"},
        {"title": "Отчёты по годам", "rows": _report_year_rows, "icon": "file"},
    ],
    actions=[
        {
            "label": "Создать тестовых проверяющих",
            "description": "По аккаунту на каждое региональное управление: auditor.r<номер региона>@test.local, пароль Test12345!",
            "endpoint": "dbs.create_test_auditors",
            "method": "post",
            "confirm": "Создать недостающие тестовые аккаунты проверяющих для всех региональных управлений? Существующие аккаунты не изменятся.",
        },
        # {
        #     "label": "Привязать старые аккаунты к erespondentN",
        #     "endpoint": "dbs.backfill_user_applications",
        #     "method": "post",
        #     "confirm": "Проставить application_id = erespondentN всем аккаунтам, у которых он ещё не задан? Действие безопасно повторять.",
        # },
    ],
)


def init_admin(app):
    site.init_app(app)
