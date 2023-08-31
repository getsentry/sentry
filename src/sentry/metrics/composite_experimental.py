from typing import Any, Dict, Optional, Type, Union

from sentry.metrics.base import MetricsBackend, Tags
from sentry.metrics.dummy import DummyMetricsBackend
from sentry.metrics.minimetrics import MiniMetricsMetricsBackend
from sentry.utils.imports import import_string


class CompositeExperimentalMetricsBackend(MetricsBackend):
    def __init__(self, prefix: Optional[str] = None, **kwargs: Any):
        super().__init__(prefix=prefix)
        self._initialize_backends(
            kwargs.pop("primary_backend", None), kwargs.pop("backend_args", {})
        )

    def _initialize_backends(self, primary_backend: Optional[str], backend_args: Dict[str, Any]):
        # If we don't have a primary metrics backend we default to the dummy, which won't do anything.
        if primary_backend is None:
            self._primary_backend = DummyMetricsBackend()

        cls: Type[MetricsBackend] = import_string(primary_backend)
        self._primary_backend = cls(**backend_args)
        self._minimetrics = MiniMetricsMetricsBackend()

    def incr(
        self,
        key: str,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        amount: Union[float, int] = 1,
        sample_rate: float = 1,
    ) -> None:
        self._primary_backend.incr(key, instance, tags, amount, sample_rate)
        self._minimetrics.incr(key, instance, tags, amount, sample_rate)

    def timing(
        self,
        key: str,
        value: float,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        sample_rate: float = 1,
    ) -> None:
        self._primary_backend.timing(key, value, instance, tags, sample_rate)
        self._minimetrics.timing(key, value, instance, tags, sample_rate)

    def gauge(
        self,
        key: str,
        value: float,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        sample_rate: float = 1,
    ) -> None:
        self._primary_backend.gauge(key, value, instance, tags, sample_rate)
        self._minimetrics.gauge(key, value, instance, tags, sample_rate)
