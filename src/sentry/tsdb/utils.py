"""
sentry.tsdb.utils
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from datetime import timedelta


class Granularity(object):
    SECONDS = 0
    MINUTES = 1
    HOURS = 2
    DAYS = 3
    WEEKS = 4
    MONTHS = 5
    YEARS = 6
    ALL_TIME = 7

    @classmethod
    def get_choices(cls):
        if hasattr(cls, '__choice_cache'):
            return cls.__choice_cache

        results = []
        for name in dir(cls):
            if name.startswith('_'):
                continue
            if not name.upper() == name:
                continue
            results.append((getattr(cls, name), name.replace('_', ' ').title()))
        cls.__choice_cache = results
        return results

    @classmethod
    def normalize_to_epoch(cls, granularity, timestamp):
        """
        Given a ``timestamp`` (datetime object) normalize the datetime object
        ``timestamp`` to an epoch timestmap (integer).

        i.e. if the granularity is minutes, the resulting timestamp would have
        the seconds and microseconds rounded down.
        """
        timestamp = timestamp.replace(microsecond=0)
        if granularity == cls.ALL_TIME:
            return 0

        if granularity == cls.SECONDS:
            return int(timestamp.strftime('%s'))

        timestamp = timestamp.replace(second=0)
        if granularity == cls.MINUTES:
            return int(timestamp.strftime('%s'))

        timestamp = timestamp.replace(minute=0)
        if granularity == cls.HOURS:
            return int(timestamp.strftime('%s'))

        timestamp = timestamp.replace(hour=0)
        if granularity == cls.DAYS:
            return int(timestamp.strftime('%s'))

        if granularity == cls.WEEKS:
            timestamp -= timedelta(days=timestamp.weekday())
        else:
            timestamp = timestamp.replace(day=1)

        if granularity == cls.YEARS:
            timestamp = timestamp.replace(month=1)

        return int(timestamp.strftime('%s'))

    @classmethod
    def get_min_timestamp(cls, granularity, timestamp):
        """
        Return the minimum value (as an epoch timestamp) to keep in storage for
        a granularity.

        Timestamp should represent the current time.

        i.e. if the granularity is seconds, the timestamp will be normalized to
        the previous minute so only latest 60 points are stored (one per second)
        """
        if granularity in (cls.ALL_TIME, cls.YEARS):
            return None

        if granularity == cls.SECONDS:
            timestamp -= timedelta(minutes=1)
        elif granularity == cls.MINUTES:
            timestamp -= timedelta(hours=1)
        elif granularity == cls.HOURS:
            timestamp -= timedelta(days=1)
        elif granularity == cls.DAYS:
            # days are stored for ~1 month
            timestamp -= timedelta(days=30)
        elif granularity == cls.WEEKS:
            # weeks are stored for a full year
            timestamp -= timedelta(days=1)

        return cls.normalize_to_epoch(granularity, timestamp)
