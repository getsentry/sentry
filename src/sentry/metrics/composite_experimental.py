from typing import Any, Dict, Optional, Type, Union

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
        self._allow_list = set(kwargs.pop("allow_list", set()))

    def _initialize_backends(
        self, primary_backend: Optional[str], primary_backend_args: Dict[str, Any]
    ):
        # If we don't have a primary metrics backend we default to the dummy, which won't do anything.
        if primary_backend is None:
            self._primary_backend: MetricsBackend = DummyMetricsBackend()
        else:
            cls: Type[MetricsBackend] = import_string(primary_backend)
            self._primary_backend = cls(**primary_backend_args)

        self._minimetrics: MetricsBackend = MiniMetricsMetricsBackend()

    def _is_allowed(self, key: str):
        return key in self._allow_list

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
    ) -> None:
        self._primary_backend.incr(key, instance, tags, amount, sample_rate, unit)
        if self._is_allowed(key) or options.get("delightful_metrics.allow_all_incr"):
            self._minimetrics.incr(
                key, instance, tags, amount, self._minimetrics_sample_rate(), unit
            )

    def timing(
        self,
        key: str,
        value: float,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        sample_rate: float = 1,
    ) -> None:
        self._primary_backend.timing(key, value, instance, tags, sample_rate)
        if self._is_allowed(key) or options.get("delightful_metrics.allow_all_timing"):
            self._minimetrics.timing(key, value, instance, tags, self._minimetrics_sample_rate())

    def gauge(
        self,
        key: str,
        value: float,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        sample_rate: float = 1,
        unit: Optional[str] = None,
    ) -> None:
        self._primary_backend.gauge(key, value, instance, tags, sample_rate, unit)
        if self._is_allowed(key) or options.get("delightful_metrics.allow_all_gauge"):
            self._minimetrics.gauge(
                key, value, instance, tags, self._minimetrics_sample_rate(), unit
            )

    def distribution(
        self,
        key: str,
        value: float,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        sample_rate: float = 1,
        unit: Optional[str] = None,
    ) -> None:
        self._primary_backend.distribution(key, value, instance, tags, sample_rate, unit)
        # We share the same option between timing and distribution, since they are both distribution
        # metrics.
        if self._is_allowed(key) or options.get("delightful_metrics.allow_all_timing"):
            self._minimetrics.distribution(
                key, value, instance, tags, self._minimetrics_sample_rate(), unit
            )
