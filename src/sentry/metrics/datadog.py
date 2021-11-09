__all__ = ["DatadogMetricsBackend"]

from datadog import ThreadStats, initialize
from datadog.util.hostname import get_hostname

from sentry.utils.cache import memoize

from .base import MetricsBackend


class DatadogMetricsBackend(MetricsBackend):
    def __init__(self, prefix=None, **kwargs):
        # TODO(dcramer): it'd be nice if the initialize call wasn't a global
        self.tags = kwargs.pop("tags", None)
        if "host" in kwargs:
            self.host = kwargs.pop("host")
        else:
            self.host = get_hostname()
        initialize(**kwargs)
        super().__init__(prefix=prefix)

    def __del__(self):
        try:
            self.stats.stop()
        except TypeError:
            # TypeError: 'NoneType' object is not callable
            pass

    @memoize
    def stats(self):
        instance = ThreadStats()
        instance.start()
        return instance

    def incr(self, key, instance=None, tags=None, amount=1, sample_rate=1):
        if tags is None:
            tags = {}
        if self.tags:
            tags.update(self.tags)
        if instance:
            tags["instance"] = instance
        if tags:
            tags = [f"{k}:{v}" for k, v in tags.items()]
        self.stats.increment(
            self._get_key(key), amount, sample_rate=sample_rate, tags=tags, host=self.host
        )

    def timing(self, key, value, instance=None, tags=None, sample_rate=1):
        if tags is None:
            tags = {}
        if self.tags:
            tags.update(self.tags)
        if instance:
            tags["instance"] = instance
        if tags:
            tags = [f"{k}:{v}" for k, v in tags.items()]
        self.stats.timing(
            self._get_key(key), value, sample_rate=sample_rate, tags=tags, host=self.host
        )

    def gauge(self, key, value, instance=None, tags=None, sample_rate=1):
        if tags is None:
            tags = {}
        if self.tags:
            tags.update(self.tags)
        if instance:
            tags["instance"] = instance
        if tags:
            tags = [f"{k}:{v}" for k, v in tags.items()]
        self.stats.gauge(
            self._get_key(key), value, sample_rate=sample_rate, tags=tags, host=self.host
        )
