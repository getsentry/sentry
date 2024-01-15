from typing import Any, Dict, Optional, Type, Union

from django.conf import settings

from sentry import options
from sentry.metrics.base import MetricsBackend, Tags
from sentry.metrics.dummy import DummyMetricsBackend
from sentry.metrics.minimetrics import MiniMetricsMetricsBackend
from sentry.options import UnknownOption
from sentry.utils.imports import import_string

__all__ = ["CompositeExperimentalMetricsBackend"]


class CompositeExperimentalMetricsBackend(MetricsBackend):
    def __init__(self, **kwargs: Any):
        super().__init__()
        self._initialize_backends(
            kwargs.pop("primary_backend", None), kwargs.pop("primary_backend_args", {})
        )
        self._deny_prefixes = tuple(kwargs.pop("deny_prefixes", []))

    def _initialize_backends(
        self, primary_backend: Optional[str], primary_backend_args: Dict[str, Any]
    ):
        # If we don't have a primary metrics backend we default to the dummy, which won't do anything.
        if primary_backend is None:
            self._primary_backend: MetricsBackend = DummyMetricsBackend()
        else:
            cls: Type[MetricsBackend] = import_string(primary_backend)
            self._primary_backend = cls(**primary_backend_args)

        self._minimetrics: MiniMetricsMetricsBackend = MiniMetricsMetricsBackend()

    def _is_denied(self, key: str) -> bool:
        return settings.SENTRY_DDM_DISABLE or key.startswith(self._deny_prefixes)

    @staticmethod
    def _minimetrics_sample_rate() -> float:
        try:
            # We want to control the sample rate of minimetrics independently of the primary backend's sample rate.
            return options.get("delightful_metrics.minimetrics_sample_rate")
        except UnknownOption:
            return 0.0

    def incr(
        self,
        key: str,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        amount: Union[float, int] = 1,
        sample_rate: float = 1,
        unit: Optional[str] = None,
        stacklevel: int = 0,
    ) -> None:
        self._primary_backend.incr(key, instance, tags, amount, sample_rate, unit)
        if not self._is_denied(key):
            self._minimetrics.incr(
                key,
                instance,
                tags,
                amount,
                self._minimetrics_sample_rate(),
                unit,
                stacklevel=stacklevel + 1,
            )

    def timing(
        self,
        key: str,
        value: float,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        sample_rate: float = 1,
        stacklevel: int = 0,
    ) -> None:
        self._primary_backend.timing(key, value, instance, tags, sample_rate)
        if not self._is_denied(key):
            self._minimetrics.timing(
                key,
                value,
                instance,
                tags,
                self._minimetrics_sample_rate(),
                stacklevel=stacklevel + 1,
            )

    def gauge(
        self,
        key: str,
        value: float,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        sample_rate: float = 1,
        unit: Optional[str] = None,
        stacklevel: int = 0,
    ) -> None:
        self._primary_backend.gauge(key, value, instance, tags, sample_rate, unit)
        if not self._is_denied(key):
            self._minimetrics.gauge(
                key,
                value,
                instance,
                tags,
                self._minimetrics_sample_rate(),
                unit,
                stacklevel=stacklevel + 1,
            )

    def distribution(
        self,
        key: str,
        value: float,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        sample_rate: float = 1,
        unit: Optional[str] = None,
        stacklevel: int = 0,
    ) -> None:
        self._primary_backend.distribution(key, value, instance, tags, sample_rate, unit)
        # We share the same option between timing and distribution, since they are both distribution
        # metrics.
        if not self._is_denied(key):
            self._minimetrics.distribution(
                key,
                value,
                instance,
                tags,
                self._minimetrics_sample_rate(),
                unit,
                stacklevel=stacklevel + 1,
            )
