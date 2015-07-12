from __future__ import absolute_import

__all__ = ['StatsdMetricsBackend']

import statsd

from .base import MetricsBackend


class StatsdMetricsBackend(MetricsBackend):
    def __init__(self, host='localhost', port=8125, **kwargs):
        self.client = statsd.StatsClient(host=host, port=port)
        super(StatsdMetricsBackend, self).__init__(**kwargs)

    def incr(self, key, amount=1, sample_rate=1):
        self.client.incr(self._get_key(key), amount, sample_rate)

    def timing(self, key, value, sample_rate=1):
        self.client.timing(self._get_key(key), value, sample_rate)
