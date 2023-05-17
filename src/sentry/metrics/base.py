__all__ = ["MetricsBackend"]

from random import random
from threading import local
from typing import Mapping, MutableMapping, Optional, Union

from django.conf import settings

# Note: One can pass a lot without TypeErrors, but some values such as None
# don't actually get serialized as tags properly all the way to statsd (they
# just get lost)
# We still loosely type here because we have too many places where we send None
# for a tag value, and sometimes even keys. It doesn't cause real bugs, your
# monitoring is just slightly broken.
TagValue = Union[str, int, float, None]
Tags = Mapping[str, TagValue]
MutableTags = MutableMapping[str, TagValue]


class MetricsBackend(local):
    def __init__(self, prefix: Optional[str] = None) -> None:
        if prefix is None:
            prefix = settings.SENTRY_METRICS_PREFIX
        self.prefix = prefix

    def _get_key(self, key: str) -> str:
        if self.prefix:
            return f"{self.prefix}{key}"
        return key

    def _should_sample(self, sample_rate: float) -> bool:
        return sample_rate >= 1 or random() >= 1 - sample_rate

    def incr(
        self,
        key: str,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        amount: Union[float, int] = 1,
        sample_rate: float = 1,
    ) -> None:
        raise NotImplementedError

    def timing(
        self,
        key: str,
        value: float,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        sample_rate: float = 1,
    ) -> None:
        raise NotImplementedError

    def gauge(
        self,
        key: str,
        value: float,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        sample_rate: float = 1,
    ) -> None:
        raise NotImplementedError
