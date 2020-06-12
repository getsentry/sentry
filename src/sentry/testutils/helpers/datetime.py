from __future__ import absolute_import
from datetime import datetime, timedelta

from django.utils import timezone

__all__ = ["iso_format", "before_now"]


def iso_format(date):
    return date.isoformat()[:19]


def before_now(**kwargs):
    return datetime.utcnow() - timedelta(**kwargs)


class MockClock(object):
    """Returns a distinct, increasing timestamp each time it is called."""

    def __init__(self, initial=None):
        self.time = initial or timezone.now()

    def __call__(self):
        self.time += timedelta(seconds=1)
        return self.time
