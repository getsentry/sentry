"""
sentry.tsdb.utils
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from datetime import timedelta


ONE_MINUTE = 60
ONE_HOUR = ONE_MINUTE * 60
ONE_DAY = ONE_HOUR * 24
ONE_MONTH = ONE_DAY * 30


ROLLUPS = (
    # time in seconds, samples to keep
    (10, 24),  # 4 minutes at 10 seconds
    (ONE_MINUTE, 30),  # 30 minutes at 1 minute
    (ONE_MINUTE * 10, 20),  # 2 hours at 10 minutes
    (ONE_HOUR, 24),  # 1 day at 1 hour
    (ONE_DAY, 30),  # 1 month at 1 day
    (ONE_MONTH, 24),  # 2 years at 1 month
)


class Rollup(object):
    @classmethod
    def get_choices(cls):
        if not hasattr(cls, '__choice_cache'):
            results = []
            for name in dir(cls):
                if name.startswith('_'):
                    continue
                if not name.upper() == name:
                    continue
                results.append((getattr(cls, name), name.replace('_', ' ').title()))
            cls.__choice_cache = sorted(results)
        return cls.__choice_cache

    @classmethod
    def normalize_to_epoch(cls, rollup, timestamp):
        """
        Given a ``timestamp`` (datetime object) normalize the datetime object
        ``timestamp`` to an epoch timestmap (integer).

        i.e. if the rollup is minutes, the resulting timestamp would have
        the seconds and microseconds rounded down.
        """
        timestamp = timestamp.replace(microsecond=0)
        if rollup == cls.ALL_TIME:
            return 0

        if rollup == cls.SECONDS:
            return int(timestamp.strftime('%s'))

        timestamp = timestamp.replace(second=0)
        if rollup == cls.MINUTES:
            return int(timestamp.strftime('%s'))

        timestamp = timestamp.replace(minute=0)
        if rollup == cls.HOURS:
            return int(timestamp.strftime('%s'))

        timestamp = timestamp.replace(hour=0)
        if rollup == cls.DAYS:
            return int(timestamp.strftime('%s'))

        if rollup == cls.WEEKS:
            timestamp -= timedelta(days=timestamp.weekday())
        else:
            timestamp = timestamp.replace(day=1)

        if rollup == cls.YEARS:
            timestamp = timestamp.replace(month=1)

        return int(timestamp.strftime('%s'))

    @classmethod
    def get_min_timestamp(cls, rollup, timestamp):
        """
        Return the minimum value (as an epoch timestamp) to keep in storage for
        a rollup.

        Timestamp should represent the current time.

        i.e. if the rollup is seconds, the timestamp will be normalized to
        the previous minute so only latest 60 points are stored (one per second)
        """
        if rollup in (cls.ALL_TIME, cls.YEARS):
            return None

        if rollup == cls.SECONDS:
            timestamp -= timedelta(minutes=1)
        elif rollup == cls.MINUTES:
            timestamp -= timedelta(hours=1)
        elif rollup == cls.HOURS:
            timestamp -= timedelta(days=1)
        elif rollup == cls.DAYS:
            # days are stored for ~1 month
            timestamp -= timedelta(days=30)
        elif rollup == cls.WEEKS:
            # weeks are stored for a full year
            timestamp -= timedelta(days=1)

        return cls.normalize_to_epoch(rollup, timestamp)
