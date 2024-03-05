from typing import Any

from datadog import initialize
from datadog.dogstatsd.base import statsd

from .base import MetricsBackend, Tags

__all__ = ["DogStatsdMetricsBackend"]


class DogStatsdMetricsBackend(MetricsBackend):
    def __init__(self, prefix: str | None = None, **kwargs: Any) -> None:
        # TODO(dcramer): it'd be nice if the initialize call wasn't a global
        self.tags = kwargs.pop("tags", None)
        initialize(**kwargs)
        statsd.disable_telemetry()
        statsd.disable_buffering = False
        super().__init__(prefix=prefix)

    def incr(
        self,
        key: str,
        instance: str | None = None,
        tags: Tags | None = None,
        amount: float | int = 1,
        sample_rate: float = 1,
        unit: str | None = None,
        stacklevel: int = 0,
    ) -> None:
        tags = dict(tags or ())

        if self.tags:
            tags.update(self.tags)
        if instance:
            tags["instance"] = instance

        tags_list = [f"{k}:{v}" for k, v in tags.items()]
        statsd.increment(self._get_key(key), amount, sample_rate=sample_rate, tags=tags_list)

    def timing(
        self,
        key: str,
        value: float,
        instance: str | None = None,
        tags: Tags | None = None,
        sample_rate: float = 1,
        stacklevel: int = 0,
    ) -> None:
        tags = dict(tags or ())

        if self.tags:
            tags.update(self.tags)
        if instance:
            tags["instance"] = instance

        tags_list = [f"{k}:{v}" for k, v in tags.items()]
        statsd.timing(self._get_key(key), value, sample_rate=sample_rate, tags=tags_list)

    def gauge(
        self,
        key: str,
        value: float,
        instance: str | None = None,
        tags: Tags | None = None,
        sample_rate: float = 1,
        unit: str | None = None,
        stacklevel: int = 0,
    ) -> None:
        tags = dict(tags or ())

        if self.tags:
            tags.update(self.tags)
        if instance:
            tags["instance"] = instance

        tags_list = [f"{k}:{v}" for k, v in tags.items()]
        statsd.gauge(self._get_key(key), value, sample_rate=sample_rate, tags=tags_list)

    def distribution(
        self,
        key: str,
        value: float,
        instance: str | None = None,
        tags: Tags | None = None,
        sample_rate: float = 1,
        unit: str | None = None,
        stacklevel: int = 0,
    ) -> None:
        # We keep the same implementation for Datadog.
        self.timing(key, value, instance, tags, sample_rate)
