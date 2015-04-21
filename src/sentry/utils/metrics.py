from __future__ import absolute_import

__all__ = ['timing', 'incr']

from django_statsd.clients import statsd
from django.conf import settings
from random import random


def _get_key(key):
    prefix = settings.SENTRY_METRICS_PREFIX
    if prefix:
        return '{}{}'.format(prefix, key)
    return key


def incr(key, amount=1):
    from sentry.app import tsdb

    sample_rate = settings.SENTRY_METRICS_SAMPLE_RATE

    statsd.incr(_get_key(key), amount,
                rate=sample_rate)

    if sample_rate >= 1 or random() >= sample_rate:
        if sample_rate < 1:
            amount = int(amount * (1.0 / sample_rate))
        tsdb.incr(tsdb.models.internal, key, count=amount)


def timing(key, value):
    # TODO(dcramer): implement timing for tsdb
    return statsd.timing(_get_key(key), value,
                         rate=settings.SENTRY_METRICS_SAMPLE_RATE)


def timer(key):
    # TODO(dcramer): implement timing for tsdb
    return statsd.timer(_get_key(key),
                        rate=settings.SENTRY_METRICS_SAMPLE_RATE)
