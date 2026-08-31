"""ErespondentN admin — model registry for the shared engine (common_models.admin)."""

from werkzeug.security import generate_password_hash

from common_models.admin import AdminSite, Field as F
from common_models import (
    User, UserAppActivity, Organization, Region, News,
    Report, Version_report, Ticket, DirUnit, DirProduct, Sections, Message,
)

site = AdminSite(
    brand="ErespondentN",
    accent="#0073c0",
    accent_2="#005fa3",
    site_endpoint="views.beginPage",
    login_endpoint="views.login",
    logout_endpoint="auth.logout",
)

# --------------------------------------------------------------------------- #
#  Основные
# --------------------------------------------------------------------------- #

site.register(
    User, name="Пользователи", group="Основные", stat_label="Пользователей",
    list_display=["id", "email", "fio", "organization", "last_active"],
    list_badges=["is_admin", "is_auditor", "is_approver", "is_reader"],
    search=["email", "fio", "last_name", "first_name", "telephone"],
    fields=[
        F("email", "Email", type="email", required=True),
        F("fio", "ФИО"),
        F("last_name", "Фамилия"), F("first_name", "Имя"), F("patronymic_name", "Отчество"),
        F("telephone", "Телефон"), F("post", "Должность"), F("type", "Тип"),
        F("is_admin", "Администратор", type="bool"),
        F("is_auditor", "Аудитор", type="bool"),
        F("is_approver", "Утверждающий", type="bool"),
        F("is_reader", "Читатель", type="bool"),
        F("organization_id", "Организация", type="fk", target=Organization, target_label="full_name"),
        F("password", "Пароль", type="password", skip_if_blank=True,
          transform=generate_password_hash, help="Оставьте пустым, чтобы не менять"),
    ],
)

site.register(
    Organization, name="Организации", group="Основные", stat_label="Организаций",
    list_display=["id", "full_name", "okpo", "region", "ministry"],
    list_badges=["is_active", "is_regular", "is_coordinator", "is_approver", "is_region_management"],
    search=["full_name", "okpo", "ynp"],
    fields=[
        F("full_name", "Полное название", required=True),
        F("okpo", "ОКПО"), F("ynp", "УНП"),
        F("region_id", "Регион", type="fk", target=Region, target_label="name"),
        F("is_active", "Активна", type="bool"),
        F("is_regular", "Обычная", type="bool"),
        F("is_coordinator", "Координатор", type="bool"),
        F("is_approver", "Утверждающая", type="bool"),
        F("is_region_management", "Региональное управление", type="bool"),
    ],
)

site.register(
    Region, name="Регионы", group="Основные",
    list_display=["id", "number", "name"], search=["name"], order_by="number",
    fields=[F("number", "Номер", type="int", required=True), F("name", "Название", required=True)],
)

site.register(
    News, name="Новости", group="Основные", stat_label="Новостей",
    list_display=["id", "title", "created_time", "views_count"],
    list_badges=["is_published", "is_enplans", "is_erespondentn"],
    search=["title", "text"],
    fields=[
        F("title", "Заголовок", required=True),
        F("text", "Текст", type="text", rows=8),
        F("img_name", "Обложка (имя файла)"),
        F("is_published", "Опубликовано", type="bool"),
        F("published_at", "Дата публикации", type="datetime"),
        F("is_enplans", "Показывать в EnPlans", type="bool"),
        F("is_erespondentn", "Показывать в ErespondentN", type="bool"),
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
        F("user_id", "Пользователь", type="fk", target=User, target_label="email"),
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
        F("sender_id", "Отправитель", type="fk", target=User, target_label="email"),
        F("recipient_id", "Получатель", type="fk", target=User, target_label="email"),
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
)

# --------------------------------------------------------------------------- #

site.dashboard(
    greeting_attr="first_name",
    stats=["news", "report", "organization", "message"],
    recent="message",
    recent_display=["create_time", "text"],
)


def init_admin(app):
    site.init_app(app)
