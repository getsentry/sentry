from __future__ import absolute_import
from datetime import datetime, timedelta

__all__ = ["iso_format", "before_now"]


def iso_format(date):
    return date.isoformat()[:19]


def before_now(**kwargs):
    return datetime.utcnow() - timedelta(**kwargs)
