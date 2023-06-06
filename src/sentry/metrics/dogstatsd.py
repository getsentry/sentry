from typing import Any, Optional, Union

from datadog import initialize, statsd

from .base import MetricsBackend, Tags

__all__ = ["DogStatsdMetricsBackend"]


class DogStatsdMetricsBackend(MetricsBackend):
    def __init__(self, prefix: Optional[str] = None, **kwargs: Any) -> None:
        # TODO(dcramer): it'd be nice if the initialize call wasn't a global
        self.tags = kwargs.pop("tags", None)
        initialize(**kwargs)
        super().__init__(prefix=prefix)

    def incr(
        self,
        key: str,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        amount: Union[float, int] = 1,
        sample_rate: float = 1,
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
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        sample_rate: float = 1,
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
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        sample_rate: float = 1,
    ) -> None:
        tags = dict(tags or ())

        if self.tags:
            tags.update(self.tags)
        if instance:
            tags["instance"] = instance

        tags_list = [f"{k}:{v}" for k, v in tags.items()]
        statsd.gauge(self._get_key(key), value, sample_rate=sample_rate, tags=tags_list)
