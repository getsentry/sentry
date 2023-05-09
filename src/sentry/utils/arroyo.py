from typing import Mapping, Optional, Union

from arroyo.utils.metrics import Metrics

from sentry.metrics.base import MetricsBackend

Tags = Mapping[str, str]


class MetricsWrapper(Metrics):
    """
    Metrics adapter for use with the Arroyo library. This allows consumer
    metrics instrumented via the Arroyo library to be automatically recorded
    and sent to Sentry's configured metrics backend.
    """

    def __init__(
        self,
        backend: MetricsBackend,
        name: Optional[str] = None,
        tags: Optional[Tags] = None,
    ) -> None:
        self.__backend = backend
        self.__name = name
        self.__tags = tags

    def __merge_name(self, name: str) -> str:
        if self.__name is None:
            return name
        else:
            return f"{self.__name}.{name}"

    def __merge_tags(self, tags: Optional[Tags]) -> Optional[Tags]:
        if self.__tags is None:
            return tags
        elif tags is None:
            return self.__tags
        else:
            return {**self.__tags, **tags}

    def increment(
        self, name: str, value: Union[int, float] = 1, tags: Optional[Tags] = None
    ) -> None:
        # sentry metrics backend uses `incr` instead of `increment`
        self.__backend.incr(key=self.__merge_name(name), amount=value, tags=self.__merge_tags(tags))

    def gauge(self, name: str, value: Union[int, float], tags: Optional[Tags] = None) -> None:
        self.__backend.gauge(key=self.__merge_name(name), value=value, tags=self.__merge_tags(tags))

    def timing(self, name: str, value: Union[int, float], tags: Optional[Tags] = None) -> None:
        self.__backend.timing(
            key=self.__merge_name(name), value=value, tags=self.__merge_tags(tags)
        )
