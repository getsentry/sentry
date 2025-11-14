from __future__ import annotations

from typing import Any, Literal, int

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
    This backend will send metrics to one or two backends, depending on options.

    The backends are configured using the `primary_backend{_args}` and `secondary_backend{_args}`
    kwargs.

    Metrics are routed based on two allow-lists:

    - `secondary_prefixes`: If the metric matches any of these prefixes,
      it is routed *only* to *only* the secondary backend.
      (for backwards compatibility reasons, the `allow_prefixes` list acts as a fallback)
    - `distribution_prefixes`: If the metric matches any of these prefixes,
      any `distribution` or `timing` metric is routed to *both* backends,
      all other metrics are routed *only* to the primary backend.
    - If the metric is not matched by any prefix, it is routed to *only* the primary backend.

    Additionally, an `experimental_backend` can be configured with `experimental_args`.
    Metrics will always be sent to the experimental backend (in addition to primary/secondary)
    unless they match the `deny_list` prefixes in `experimental_args`.

    """

    def __init__(self, **kwargs: Any):
        super().__init__()
        self._primary_backend = _initialize_backend(
            kwargs.pop("primary_backend", None), kwargs.pop("primary_backend_args", {})
        )
        self._secondary_backend = _initialize_backend(
            kwargs.pop("secondary_backend", None), kwargs.pop("secondary_backend_args", {})
        )
        self._experimental_backend = _initialize_backend(
            kwargs.pop("experimental_backend", None), kwargs.pop("experimental_args", {})
        )

        self._distribution_prefixes = tuple(kwargs.pop("distribution_prefixes", []))
        self._secondary_prefixes = tuple(
            kwargs.pop("secondary_prefixes", []) or kwargs.pop("allow_prefixes", [])
        )

    def _distribution_choice(self, key: str) -> tuple[bool, bool]:
        if key.startswith(self._secondary_prefixes):
            return False, True
        if key.startswith(self._distribution_prefixes):
            return True, True

        return True, False

    def _other_choice(self, key: str) -> tuple[bool, bool]:
        if key.startswith(self._secondary_prefixes):
            return False, True

        return True, False

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
        use_primary, use_secondary = self._other_choice(key)
        if use_primary:
            self._primary_backend.incr(
                key, instance, tags, amount, sample_rate, unit, stacklevel + 1
            )
        if use_secondary:
            self._secondary_backend.incr(
                key, instance, tags, amount, sample_rate, unit, stacklevel + 1
            )
        self._experimental_backend.incr(
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
        use_primary, use_secondary = self._distribution_choice(key)
        if use_primary:
            self._primary_backend.timing(key, value, instance, tags, sample_rate, stacklevel + 1)
        if use_secondary:
            self._secondary_backend.timing(key, value, instance, tags, sample_rate, stacklevel + 1)
        self._experimental_backend.timing(key, value, instance, tags, sample_rate, stacklevel + 1)

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
        use_primary, use_secondary = self._other_choice(key)
        if use_primary:
            self._primary_backend.gauge(
                key, value, instance, tags, sample_rate, unit, stacklevel + 1
            )
        if use_secondary:
            self._secondary_backend.gauge(
                key, value, instance, tags, sample_rate, unit, stacklevel + 1
            )
        self._experimental_backend.gauge(
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
        use_primary, use_secondary = self._distribution_choice(key)
        if use_primary:
            self._primary_backend.distribution(
                key, value, instance, tags, sample_rate, unit, stacklevel + 1
            )
        if use_secondary:
            self._secondary_backend.distribution(
                key, value, instance, tags, sample_rate, unit, stacklevel + 1
            )
        self._experimental_backend.distribution(
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
        use_primary, use_secondary = self._other_choice(title)
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
        self._experimental_backend.event(
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
