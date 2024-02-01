from typing import Optional, Union

from sentry_redis_tools.metrics import Metrics, Tags

from sentry.metrics.base import MetricsBackend


class RedisToolsMetricsBackend(Metrics):
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
        self,
        name: str,
        value: Union[int, float] = 1,
        tags: Optional[Tags] = None,
    ) -> None:
        self.__backend.incr(
            key=self.__merge_name(name),
            amount=value,
            tags=self.__merge_tags(tags),
            stacklevel=1,
        )

    def gauge(
        self,
        name: str,
        value: Union[int, float],
        tags: Optional[Tags] = None,
    ) -> None:
        self.__backend.gauge(
            key=self.__merge_name(name),
            value=value,
            tags=self.__merge_tags(tags),
            stacklevel=1,
        )

    def timing(
        self,
        name: str,
        value: Union[int, float],
        tags: Optional[Tags] = None,
    ) -> None:
        self.__backend.timing(
            key=self.__merge_name(name),
            value=value,
            tags=self.__merge_tags(tags),
            stacklevel=1,
        )
