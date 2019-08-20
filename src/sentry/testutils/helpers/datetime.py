from __future__ import absolute_import
from datetime import timedelta

__all__ = ["iso_format", "before_now"]


from django.utils import timezone


def iso_format(date):
    return date.isoformat()[:19]


def before_now(**kwargs):
    return timezone.now() - timedelta(**kwargs)
