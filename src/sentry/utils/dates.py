"""
sentry.utils.dates
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import six

from datetime import (
    datetime,
    timedelta,
)

import pytz
from dateutil.parser import parse
from django.db import connections

from sentry.utils.db import get_db_engine


DATE_TRUNC_GROUPERS = {
    'oracle': {
        'hour': 'hh24',
    },
    'default': {
        'date': 'day',
        'hour': 'hour',
        'minute': 'minute',
    },
}


epoch = datetime(1970, 1, 1, tzinfo=pytz.utc)


def to_timestamp(value):
    """
    Convert a time zone aware datetime to a POSIX timestamp (with fractional
    component.)
    """
    return (value - epoch).total_seconds()


def to_datetime(value):
    """
    Convert a POSIX timestamp to a time zone aware datetime.

    The timestamp value must be a numeric type (either a integer or float,
    since it may contain a fractional component.)
    """
    return epoch + timedelta(seconds=value)


def floor_to_utc_day(value):
    """
    Floors a given datetime to UTC midnight.
    """
    return value.astimezone(pytz.utc).replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )


def get_sql_date_trunc(col, db='default', grouper='hour'):
    conn = connections[db]

    engine = get_db_engine(db)
    # TODO: does extract work for sqlite?
    if engine.startswith('oracle'):
        method = DATE_TRUNC_GROUPERS['oracle'].get(grouper, DATE_TRUNC_GROUPERS['default'][grouper])
        if '"' not in col:
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


def parse_timestamp(value):
    # TODO(mitsuhiko): merge this code with coreapis date parser
    if isinstance(value, datetime):
        return value
    elif isinstance(value, six.integer_types + (float,)):
        return datetime.utcfromtimestamp(value).replace(tzinfo=pytz.utc)
    value = (value or '').rstrip('Z').encode('ascii', 'replace').split('.', 1)
    if not value:
        return None
    try:
        rv = datetime.strptime(value[0], '%Y-%m-%dT%H:%M:%S')
    except Exception:
        return None
    if len(value) == 2:
        try:
            rv = rv.replace(microsecond=int(value[1]
                            .ljust(6, '0')[:6]))
        except ValueError:
            rv = None
    return rv.replace(tzinfo=pytz.utc)
