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
    # return datetime(*time.gmtime(time.mktime(dt.timetuple()))[:6])
    # return dt.replace(tzinfo=pytz.utc)
    return dt.replace(tzinfo=pytz.utc).astimezone(tz).replace(tzinfo=None)
