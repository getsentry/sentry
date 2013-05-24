"""
sentry.tsdb.utils
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""


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
    def normalize_to_epoch(cls, timestamp, seconds):
        """
        Given a ``timestamp`` (datetime object) normalize the datetime object
        ``timestamp`` to an epoch timestmap (integer).

        i.e. if the rollup is minutes, the resulting timestamp would have
        the seconds and microseconds rounded down.
        """
        return int(int(timestamp.strftime('%s')) / seconds)
