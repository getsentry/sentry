import time
from datetime import datetime, timedelta
from warnings import warn

from django.utils import timezone

__all__ = ["iso_format", "before_now", "timestamp_format"]


def iso_format(date):
    return date.isoformat()[:19]


def before_now(**kwargs):
    delta = timedelta(**kwargs)
    if delta == timedelta(seconds=1):
        warn(
            "Using an event 1 second in the past may result in flakey tests. Please use a timestamp further in the past like 10 seconds.",
            DeprecationWarning,
            stacklevel=2,
        )
    date = datetime.utcnow() - delta
    return date - timedelta(microseconds=date.microsecond % 1000)


def timestamp_format(datetime):
    return time.mktime(datetime.utctimetuple()) + datetime.microsecond / 1e6


class MockClock:
    """Returns a distinct, increasing timestamp each time it is called."""

    def __init__(self, initial=None):
        self.time = initial or timezone.now()

    def __call__(self):
        self.time += timedelta(seconds=1)
        return self.time
