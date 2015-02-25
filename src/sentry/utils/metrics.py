from __future__ import absolute_import

__all__ = ['timing', 'incr']

from django_statsd.clients import statsd
from django.conf import settings


def _get_key(key):
    prefix = settings.SENTRY_METRICS_PREFIX
    if prefix:
        return '{}{}'.format(prefix, key)
    return key


def incr(key, amount=1):
    return statsd.incr(_get_key(key), amount)


def timing(key, value):
    return statsd.timing(_get_key(key), value)


def timer(key):
    return statsd.timer(_get_key(key))
