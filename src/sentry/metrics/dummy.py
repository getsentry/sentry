from __future__ import absolute_import

from .base import MetricsBackend

__all__ = ['DummyMetricsBackend']


class DummyMetricsBackend(MetricsBackend):
    def incr(self, key, instance=None, tags=None, amount=1, rate=1):
        pass

    def timing(self, key, value, instance=None, tags=None, rate=1):
        pass
