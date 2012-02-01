"""
sentry.utils.dates
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import pytz

from django.conf import settings


def utc_to_local(dt):
    tz = pytz.timezone(settings.TIME_ZONE)
    return dt.replace(tzinfo=pytz.utc).astimezone(tz).replace(tzinfo=None)


def local_to_utc(dt):
    tz = pytz.timezone(settings.TIME_ZONE)
    return dt.replace(tzinfo=tz).astimezone(pytz.utc).replace(tzinfo=None)
