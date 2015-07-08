from __future__ import absolute_import

__all__ = ['MetricsBackend']

from django.conf import settings
from random import random
from threading import local


class MetricsBackend(local):
    def __init__(self, prefix=None):
        if prefix is None:
            prefix = settings.SENTRY_METRICS_PREFIX
        self.prefix = prefix

    def _get_key(self, key):
        if self.prefix:
            return '{}{}'.format(self.prefix, key)
        return key

    def _should_sample(self, rate):
        return rate >= 1 or random() >= 1 - rate

    def incr(self, key, amount=1, rate=1):
        raise NotImplementedError

    def timing(self, key, value, rate=1):
        raise NotImplementedError
