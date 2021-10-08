__all__ = ["DogStatsdMetricsBackend"]

from datadog import initialize, statsd

from .base import MetricsBackend


class DogStatsdMetricsBackend(MetricsBackend):
    def __init__(self, prefix=None, **kwargs):
        # TODO(dcramer): it'd be nice if the initialize call wasn't a global
        self.tags = kwargs.pop("tags", None)
        initialize(**kwargs)
        super().__init__(prefix=prefix)

    def incr(self, key, instance=None, tags=None, amount=1, sample_rate=1):
        if tags is None:
            tags = {}
        if self.tags:
            tags.update(self.tags)
        if instance:
            tags["instance"] = instance
        if tags:
            tags = [f"{k}:{v}" for k, v in tags.items()]
        statsd.increment(self._get_key(key), amount, sample_rate=sample_rate, tags=tags)

    def timing(self, key, value, instance=None, tags=None, sample_rate=1):
        if tags is None:
            tags = {}
        if self.tags:
            tags.update(self.tags)
        if instance:
            tags["instance"] = instance
        if tags:
            tags = [f"{k}:{v}" for k, v in tags.items()]
        statsd.timing(self._get_key(key), value, sample_rate=sample_rate, tags=tags)

    def gauge(self, key, value, instance=None, tags=None, sample_rate=1):
        if tags is None:
            tags = {}
        if self.tags:
            tags.update(self.tags)
        if instance:
            tags["instance"] = instance
        if tags:
            tags = [f"{k}:{v}" for k, v in tags.items()]
        statsd.gauge(self._get_key(key), value, sample_rate=sample_rate, tags=tags)
