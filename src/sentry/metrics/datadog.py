__all__ = ["DatadogMetricsBackend"]

from typing import Any, Optional, Union

from datadog import ThreadStats, initialize
from datadog.util.hostname import get_hostname

from sentry.utils.cache import memoize

from .base import MetricsBackend, Tags


class DatadogMetricsBackend(MetricsBackend):
    def __init__(self, prefix: Optional[str] = None, **kwargs: Any) -> None:
        # TODO(dcramer): it'd be nice if the initialize call wasn't a global
        self.tags = kwargs.pop("tags", None)
        if "host" in kwargs:
            self.host = kwargs.pop("host")
        else:
            self.host = get_hostname()
        initialize(**kwargs)
        super().__init__(prefix=prefix)

    def __del__(self) -> None:
        try:
            self.stats.stop()
        except TypeError:
            # TypeError: 'NoneType' object is not callable
            pass

    @memoize
    def stats(self) -> ThreadStats:
        instance = ThreadStats()
        instance.start()
        return instance

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
        self.stats.increment(
            self._get_key(key), amount, sample_rate=sample_rate, tags=tags_list, host=self.host
        )

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
        self.stats.timing(
            self._get_key(key), value, sample_rate=sample_rate, tags=tags_list, host=self.host
        )

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
        self.stats.gauge(
            self._get_key(key), value, sample_rate=sample_rate, tags=tags_list, host=self.host
        )
