from __future__ import annotations

from typing import Any, Literal

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


CounterStrategy = Literal["primary", "secondary", "both"]


class DualWriteMetricsBackend(MetricsBackend):
    """
    This backend will send eligible metrics to one or two backends.

    The backends are configured using the `primary_backend{_args}` and `secondary_backend{_args}`
    kwargs.

    Metrics that are matching the `allowed_prefixes` will be routed according to the following
    rules:

    - "Distribution-like" metrics, such as `timing` and `distribution`, will be
      sent to both configured backends.
    - All other metrics (`incr`, `gauge`, `event`), which I call "counter-like"
      will be routed according to the `counter_strategy` option:
      - This can be `primary` to always send to the primary backend, effectively ignoring `allowed_prefixes`.
      - Or it can be `both`, or `secondary`, in which case allow-listed metrics will
        be send to both or the secondary backend only, accordingly.

      The default is `secondary`, so that allowlisted metrics are *only* routed to the secondary
      backend, to avoid double-counting.
      This is not an issue with "distribution-like" metrics, as the currently configured `primary`
      is synthesizing multiple metrics out of a single distribution metric,
      which do not conflict with the distribution metric itself.
    """

    def __init__(self, **kwargs: Any):
        super().__init__()
        self._primary_backend = _initialize_backend(
            kwargs.pop("primary_backend", None), kwargs.pop("primary_backend_args", {})
        )
        self._secondary_backend = _initialize_backend(
            kwargs.pop("secondary_backend", None), kwargs.pop("secondary_backend_args", {})
        )

        self._allow_prefixes = tuple(kwargs.pop("allow_prefixes", []))
        self._counter_strategy = kwargs.pop("counter_strategy", "secondary")

    def _is_allowed(self, key: str) -> bool:
        return key.startswith(self._allow_prefixes)

    def _counter_choice(self, key: str) -> tuple[bool, bool]:
        is_allowed = self._is_allowed(key)
        use_primary = not is_allowed or self._counter_strategy != "secondary"
        use_secondary = is_allowed and self._counter_strategy != "primary"
        return use_primary, use_secondary

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
        use_primary, use_secondary = self._counter_choice(key)
        if use_primary:
            self._primary_backend.incr(
                key, instance, tags, amount, sample_rate, unit, stacklevel + 1
            )
        if use_secondary:
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
        use_primary, use_secondary = self._counter_choice(key)
        if use_primary:
            self._primary_backend.gauge(
                key, value, instance, tags, sample_rate, unit, stacklevel + 1
            )
        if use_secondary:
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
        use_primary, use_secondary = self._counter_choice(title)
        if use_primary:
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
        if use_secondary:
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
