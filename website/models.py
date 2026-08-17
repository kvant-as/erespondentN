from datetime import datetime

from pytz import timezone
from common_models.src import (
    User, Organization, Region, Ministry,
    Message, Report, Version_report, Ticket,
    DirUnit, DirProduct, Sections, News
)

def current_utc_time():
    return datetime.now(timezone.utc)

__all__ = [
    'User', 'Organization', 'Region', 'Ministry',
    'Message', 'Report', 'Version_report', 'Ticket',
    'DirUnit', 'DirProduct', 'Sections', 'News'
]