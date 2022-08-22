__all__ = ["DummyMetricsBackend"]

from .base import MetricsBackend


class DummyMetricsBackend(MetricsBackend):
    def incr(self, key, instance=None, tags=None, amount=1, sample_rate=1):
        pass

    def timing(self, key, value, instance=None, tags=None, sample_rate=1):
        pass

    def gauge(self, key, value, instance=None, tags=None, sample_rate=1):
        pass
