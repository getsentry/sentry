from __future__ import annotations

import pickle
from functools import partial
from typing import Any, Callable, Mapping, Optional, Union

from arroyo.processing.strategies.run_task_with_multiprocessing import (
    MultiprocessingPool as ArroyoMultiprocessingPool,
)
from arroyo.processing.strategies.run_task_with_multiprocessing import (
    RunTaskWithMultiprocessing as ArroyoRunTaskWithMultiprocessing,
)
from arroyo.processing.strategies.run_task_with_multiprocessing import TResult
from arroyo.types import TStrategyPayload
from arroyo.utils.metrics import Metrics
from django.conf import settings

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
        self,
        name: str,
        value: Union[int, float] = 1,
        tags: Optional[Tags] = None,
        stacklevel: int = 0,
    ) -> None:
        # sentry metrics backend uses `incr` instead of `increment`
        self.__backend.incr(
            key=self.__merge_name(name),
            amount=value,
            tags=self.__merge_tags(tags),
            stacklevel=stacklevel + 1,
        )

    def gauge(
        self,
        name: str,
        value: Union[int, float],
        tags: Optional[Tags] = None,
        stacklevel: int = 0,
    ) -> None:
        self.__backend.gauge(
            key=self.__merge_name(name),
            value=value,
            tags=self.__merge_tags(tags),
            stacklevel=stacklevel + 1,
        )

    def timing(
        self,
        name: str,
        value: Union[int, float],
        tags: Optional[Tags] = None,
        stacklevel: int = 0,
    ) -> None:
        self.__backend.timing(
            key=self.__merge_name(name),
            value=value,
            tags=self.__merge_tags(tags),
            stacklevel=stacklevel + 1,
        )


def _get_arroyo_subprocess_initializer(
    initializer: Optional[Callable[[], None]]
) -> Callable[[], None]:
    from sentry.metrics.middleware import get_current_global_tags

    # One can add integer tags and other invalid types today. Filter out any
    # tags that may not be pickleable. Because those tags are getting pickled
    # as part of the constructed partial()
    tags: Tags = {k: v for k, v in get_current_global_tags().items() if isinstance(v, str)}
    return partial(_initialize_arroyo_subprocess, initializer=initializer, tags=tags)


def _initialize_arroyo_subprocess(initializer: Optional[Callable[[], None]], tags: Tags) -> None:
    from sentry.runner import configure

    configure()

    if initializer:
        initializer()

    from sentry.metrics.middleware import add_global_tags

    # Inherit global tags from the parent process
    add_global_tags(_all_threads=True, **tags)


def initialize_arroyo_main() -> None:
    from arroyo import configure_metrics

    from sentry.utils.metrics import backend

    metrics_wrapper = MetricsWrapper(backend, name="consumer")
    configure_metrics(metrics_wrapper)


class MultiprocessingPool:
    def __init__(
        self, num_processes: int, initializer: Optional[Callable[[], None]] = None
    ) -> None:
        self.__initializer = initializer
        if settings.KAFKA_CONSUMER_FORCE_DISABLE_MULTIPROCESSING:
            self.__pool = None
        else:
            self.__pool = ArroyoMultiprocessingPool(
                num_processes, _get_arroyo_subprocess_initializer(initializer)
            )

    @property
    def initializer(self) -> Optional[Callable[[], None]]:
        return self.__initializer

    @property
    def pool(self) -> Optional[ArroyoMultiprocessingPool]:
        return self.__pool

    def close(self) -> None:
        if self.__pool is not None:
            self.__pool.close()


class RunTaskWithMultiprocessing(ArroyoRunTaskWithMultiprocessing[TStrategyPayload, TResult]):
    """
    A variant of arroyo's RunTaskWithMultiprocessing that can switch between
    multiprocessing and non-multiprocessing mode based on the
    `KAFKA_CONSUMER_FORCE_DISABLE_MULTIPROCESSING` setting.
    """

    def __new__(
        cls,
        *,
        pool: MultiprocessingPool,
        **kwargs: Any,
    ) -> RunTaskWithMultiprocessing:
        if settings.KAFKA_CONSUMER_FORCE_DISABLE_MULTIPROCESSING:
            from arroyo.processing.strategies.run_task import RunTask

            kwargs.pop("num_processes", None)
            kwargs.pop("input_block_size", None)
            kwargs.pop("output_block_size", None)
            kwargs.pop("max_batch_size", None)
            kwargs.pop("max_batch_time", None)

            if pool.initializer is not None:
                pool.initializer()

            # Assert that initializer can be pickled and loaded again from subprocesses.
            pickle.loads(pickle.dumps(pool.initializer))
            pickle.loads(pickle.dumps(kwargs["function"]))

            return RunTask(**kwargs)  # type: ignore[return-value]
        else:
            from arroyo.processing.strategies.run_task_with_multiprocessing import (
                RunTaskWithMultiprocessing as ArroyoRunTaskWithMultiprocessing,
            )

            assert pool.pool is not None

            return ArroyoRunTaskWithMultiprocessing(  # type: ignore[return-value]
                pool=pool.pool, **kwargs
            )
