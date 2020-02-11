from __future__ import absolute_import

__all__ = ["StatsdMetricsBackend"]

import statsd

from .base import MetricsBackend


class StatsdMetricsBackend(MetricsBackend):
    def __init__(self, host="localhost", port=8125, **kwargs):
        try:
            self.client = statsd.StatsClient(host=host, port=port)
        except:
            pass
        super(StatsdMetricsBackend, self).__init__(**kwargs)

    def _full_key(self, key, instance=None):
        if instance:
            return u"{}.{}".format(key, instance)
        return key

    def incr(self, key, instance=None, tags=None, amount=1, sample_rate=1):
        if self.client:
            self.client.incr(self._full_key(self._get_key(key)), amount, sample_rate)

    def timing(self, key, value, instance=None, tags=None, sample_rate=1):
        if self.client:
            self.client.timing(self._full_key(self._get_key(key)), value, sample_rate)
