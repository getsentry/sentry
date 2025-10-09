from typing import Any

from sentry import options
from sentry.metrics.base import MetricsBackend, Tags
from sentry.metrics.dummy import DummyMetricsBackend
from sentry.metrics.sentry_sdk import SentrySDKMetricsBackend
from sentry.utils.imports import import_string
from sentry.utils.options import sample_modulo

__all__ = ["CompositeExperimentalMetricsBackend"]


class CompositeExperimentalMetricsBackend(MetricsBackend):
    def __init__(self, **kwargs: Any):
        super().__init__(**kwargs)
        self._initialize_backends(
            kwargs.pop("primary_backend", None), kwargs.pop("primary_backend_args", {})
        )
        self._deny_prefixes = tuple(kwargs.pop("deny_prefixes", []))

    def _initialize_backends(
        self, primary_backend: str | None, primary_backend_args: dict[str, Any]
    ) -> None:
        if primary_backend is None:
            self._primary_backend: MetricsBackend = DummyMetricsBackend(prefix=self.prefix)
        else:
            cls: type[MetricsBackend] = import_string(primary_backend)
            self._primary_backend = cls(prefix=self.prefix, **primary_backend_args)

        self._sentry_sdk_backend: SentrySDKMetricsBackend = SentrySDKMetricsBackend(
            prefix=self.prefix
        )

    def _is_denied(self, key: str) -> bool:
        return key.startswith(self._deny_prefixes)

    def _should_send_to_sentry_sdk(self, key: str) -> bool:
        if self._is_denied(key):
            return False

        sample_rate = options.get("tracemetrics.sentry_sdk_metrics_backend_rate", 0.0)
        if sample_rate <= 0:
            return False

        key_hash = hash(key) & 0x7FFFFFFF
        return sample_modulo("tracemetrics.sentry_sdk_metrics_backend_rate", key_hash)

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
        self._primary_backend.incr(key, instance, tags, amount, sample_rate, unit)
        if self._should_send_to_sentry_sdk(key):
            self._sentry_sdk_backend.incr(
                key,
                instance,
                tags,
                amount,
                sample_rate,
                unit,
                stacklevel=stacklevel + 1,
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
        self._primary_backend.timing(key, value, instance, tags, sample_rate)

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
        self._primary_backend.gauge(key, value, instance, tags, sample_rate, unit)
        if self._should_send_to_sentry_sdk(key):
            self._sentry_sdk_backend.gauge(
                key,
                value,
                instance,
                tags,
                sample_rate,
                unit,
                stacklevel=stacklevel + 1,
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
        self._primary_backend.distribution(key, value, instance, tags, sample_rate, unit)
        if self._should_send_to_sentry_sdk(key):
            self._sentry_sdk_backend.distribution(
                key,
                value,
                instance,
                tags,
                sample_rate,
                unit,
                stacklevel=stacklevel + 1,
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
