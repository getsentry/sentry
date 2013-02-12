"""
sentry.counter.base
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""


class Counter(object):
    """
    A counter is a temporary store for real-time counts for recent historical
    data on events.

    Specifically, they store the following:

    - events per project

    Each grouping tracks the following:

    - # of total events
    - # of unique events

    Each counter stores counts at minute-level intervals for 15 minutes.
    """
    MINUTES = 15

    def __init__(self, **options):
        pass

    def incr(self, group, is_new=False, **kwargs):
        """
        >>> incr(group, is_new=False)
        """
        pass

    def total(self, key, value, minutes=None):
        return None

    def unique(self, key, value, minutes=None):
        return None
