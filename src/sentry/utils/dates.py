"""
sentry.utils.dates
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from datetime import datetime
from dateutil.parser import parse
from django.db import connections

from sentry.constants import MINUTE_NORMALIZATION
from sentry.utils.db import get_db_engine

DATE_TRUNC_GROUPERS = {
    'oracle': {
        'hour': 'hh24',
    },
    'default': {
        'hour': 'hour',
        'minute': 'minute',
    },
}


def get_sql_date_trunc(col, db='default', grouper='hour'):
    conn = connections[db]

    engine = get_db_engine(db)
    # TODO: does extract work for sqlite?
    if engine.startswith('oracle'):
        method = DATE_TRUNC_GROUPERS['oracle'].get(grouper, DATE_TRUNC_GROUPERS['default'][grouper])
        if not '"' in col:
            col = '"%s"' % col.upper()
    else:
        method = DATE_TRUNC_GROUPERS['default'][grouper]
    return conn.ops.date_trunc_sql(method, col)


def parse_date(datestr, timestr):
    # format is Y-m-d
    if not (datestr or timestr):
        return
    if not timestr:
        return datetime.strptime(datestr, '%Y-%m-%d')

    datetimestr = datestr.strip() + ' ' + timestr.strip()
    try:
        return datetime.strptime(datetimestr, '%Y-%m-%d %I:%M %p')
    except Exception:
        try:
            return parse(datetimestr)
        except Exception:
            return


def normalize_datetime(datetime, minutes=MINUTE_NORMALIZATION):
    minutes = (datetime.minute - (datetime.minute % minutes))
    normalized_datetime = datetime.replace(second=0, microsecond=0, minute=minutes)
    return normalized_datetime
