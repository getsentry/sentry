from __future__ import absolute_import

__all__ = ['DatadogMetricsBackend']

from datadog import initialize, ThreadStats

from .base import MetricsBackend


class DatadogMetricsBackend(MetricsBackend):
    def __init__(self, prefix=None, **kwargs):
        self._stats = ThreadStats()
        self._stats.start()
        # TODO(dcramer): it'd be nice if the initialize call wasn't a global
        initialize(**kwargs)
        super(DatadogMetricsBackend, self).__init__(prefix=prefix)

    def __del__(self):
        self._stats.stop()

    def incr(self, key, amount=1, sample_rate=1):
        self._stats.increment(self._get_key(key), amount, sample_rate=sample_rate)

    def timing(self, key, value, sample_rate=1):
        self._stats.timing(self._get_key(key), value, sample_rate=sample_rate)
