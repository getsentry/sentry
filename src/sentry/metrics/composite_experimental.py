from typing import Any, Dict, Optional, Type, Union

from sentry import options
from sentry.metrics.base import MetricsBackend, Tags
from sentry.metrics.dummy import DummyMetricsBackend
from sentry.metrics.minimetrics import MiniMetricsMetricsBackend
from sentry.options import UnknownOption
from sentry.utils.imports import import_string


class CompositeExperimentalMetricsBackend(MetricsBackend):
    def __init__(self, prefix: Optional[str] = None, **kwargs: Any):
        super().__init__(prefix=prefix)
        self._initialize_backends(
            kwargs.pop("primary_backend", None), kwargs.pop("backend_args", {})
        )
        self._allow_list = set(kwargs.pop("allow_list", set()))

    def _initialize_backends(self, primary_backend: Optional[str], backend_args: Dict[str, Any]):
        # If we don't have a primary metrics backend we default to the dummy, which won't do anything.
        if primary_backend is None:
            self._primary_backend: MetricsBackend = DummyMetricsBackend()
        else:
            cls: Type[MetricsBackend] = import_string(primary_backend)
            # In case there is a prefix, we don't want to push it downstream, since it will be already prefixed by
            # this backend instance. With this you NEED to make sure that the primary backend has a default value for
            # `prefix`.
            backend_args.pop("prefix", None)
            self._primary_backend = cls(**backend_args)

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
    ) -> None:
        prefixed_key = self._get_key(key)
        self._primary_backend.incr(prefixed_key, instance, tags, amount, sample_rate)
        if self._is_allowed(key):
            self._minimetrics.incr(
                prefixed_key, instance, tags, amount, self._minimetrics_sample_rate()
            )

    def timing(
        self,
        key: str,
        value: float,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        sample_rate: float = 1,
    ) -> None:
        prefixed_key = self._get_key(key)
        self._primary_backend.timing(prefixed_key, value, instance, tags, sample_rate)
        if self._is_allowed(key):
            self._minimetrics.timing(
                prefixed_key, value, instance, tags, self._minimetrics_sample_rate()
            )

    def gauge(
        self,
        key: str,
        value: float,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        sample_rate: float = 1,
    ) -> None:
        prefixed_key = self._get_key(key)
        self._primary_backend.gauge(prefixed_key, value, instance, tags, sample_rate)
        if self._is_allowed(key):
            self._minimetrics.gauge(
                prefixed_key, value, instance, tags, self._minimetrics_sample_rate()
            )
