"""
sentry.tsdb.utils
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""


ONE_MINUTE = 60
ONE_HOUR = ONE_MINUTE * 60
ONE_DAY = ONE_HOUR * 24


ROLLUPS = (
    # time in seconds, samples to keep
    (10, 30),  # 5 minutes at 10 seconds
    (ONE_MINUTE, 120),  # 2 hours at 1 minute
    (ONE_HOUR, 48),  # 2 days at 1 hour
    (ONE_DAY, 365),  # 1 year at 1 day
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
        epoch = int(timestamp.strftime('%s'))
        print epoch, epoch % seconds
        return epoch - (epoch % seconds)
