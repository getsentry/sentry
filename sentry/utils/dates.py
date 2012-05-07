"""
sentry.utils.dates
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import pytz

from datetime import datetime
from dateutil.parser import parse
from django.conf import settings
from django.db import connections

from sentry.utils.db import get_db_engine


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


def parse_date(datestr, timestr):
    # format is Y-m-d
    if not (datestr or timestr):
        return
    if not timestr:
        return datetime.strptime(datestr, '%Y-%m-%d')

    datetimestr = datestr.strip() + ' ' + timestr.strip()
    try:
        return datetime.strptime(datetimestr, '%Y-%m-%d %I:%M %p')
    except:
        try:
            return parse(datetimestr)
        except:
            return
