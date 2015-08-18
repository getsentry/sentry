from __future__ import absolute_import

__all__ = ['DummyMetricsBackend']

from .base import MetricsBackend


class DummyMetricsBackend(MetricsBackend):
    def incr(self, key, amount=1, rate=1):
        pass

    def timing(self, key, value, rate=1):
        pass
