from typing import Any

from sentry.metrics.base import MetricsBackend, Tags
from sentry.metrics.dummy import DummyMetricsBackend
from sentry.utils.imports import import_string

__all__ = ["DualWriteMetricsBackend"]


def _initialize_backend(backend: str | None, backend_args: dict[str, Any]) -> MetricsBackend:
    if backend is None:
        return DummyMetricsBackend()
    else:
        cls: type[MetricsBackend] = import_string(backend)
        return cls(**backend_args)


class DualWriteMetricsBackend(MetricsBackend):
    def __init__(self, **kwargs: Any):
        super().__init__()
        self._primary_backend = _initialize_backend(
            kwargs.pop("primary_backend", None), kwargs.pop("primary_backend_args", {})
        )
        self._secondary_backend = _initialize_backend(
            kwargs.pop("secondary_backend", None), kwargs.pop("secondary_backend_args", {})
        )

        self._allow_prefixes = tuple(kwargs.pop("allow_prefixes", []))

    def _is_allowed(self, key: str) -> bool:
        return key.startswith(self._allow_prefixes)

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
        self._primary_backend.incr(key, instance, tags, amount, sample_rate, unit, stacklevel + 1)
        if self._is_allowed(key):
            self._secondary_backend.incr(
                key, instance, tags, amount, sample_rate, unit, stacklevel + 1
            )

    def timing(
        self,
        key: str,
        value: float,
        instance: str | None = None,
        tags: Tags | None = None,
        sample_rate: float = 1,
        stacklevel: int = 0,
    ) -> None:
        self._primary_backend.timing(key, value, instance, tags, sample_rate, stacklevel + 1)
        if self._is_allowed(key):
            self._secondary_backend.timing(key, value, instance, tags, sample_rate, stacklevel + 1)

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
        self._primary_backend.gauge(key, value, instance, tags, sample_rate, unit, stacklevel + 1)
        if self._is_allowed(key):
            self._secondary_backend.gauge(
                key, value, instance, tags, sample_rate, unit, stacklevel + 1
            )

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
        self._primary_backend.distribution(
            key, value, instance, tags, sample_rate, unit, stacklevel + 1
        )
        if self._is_allowed(key):
            self._secondary_backend.distribution(
                key, value, instance, tags, sample_rate, unit, stacklevel + 1
            )

    def event(
        self,
        title: str,
        message: str,
        alert_type: str | None = None,
        aggregation_key: str | None = None,
        source_type_name: str | None = None,
        priority: str | None = None,
        instance: str | None = None,
        tags: Tags | None = None,
        stacklevel: int = 0,
    ) -> None:
        self._primary_backend.event(
            title,
            message,
            alert_type,
            aggregation_key,
            source_type_name,
            priority,
            instance,
            tags,
            stacklevel + 1,
        )
        if self._is_allowed(title):
            self._secondary_backend.event(
                title,
                message,
                alert_type,
                aggregation_key,
                source_type_name,
                priority,
                instance,
                tags,
                stacklevel + 1,
            )
