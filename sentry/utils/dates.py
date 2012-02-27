"""
sentry.utils.dates
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import pytz

from django.conf import settings
from django.db import connections
from sentry.utils import get_db_engine


def utc_to_local(dt):
    tz = pytz.timezone(settings.TIME_ZONE)
    return tz.fromutc(dt).replace(tzinfo=None)

def local_to_utc(dt):
    tz = pytz.timezone(settings.TIME_ZONE)
    return tz.localize(dt).astimezone(pytz.utc).replace(tzinfo=None)

def get_sql_date_trunc(col, db='default'):
    conn = connections[db]

    engine = get_db_engine(db)
    # TODO: does extract work for sqlite?
    if engine.startswith('oracle'):
        method = conn.ops.date_trunc_sql('hh24', col)
    else:
        method = conn.ops.date_trunc_sql('hour', col)

    return method
