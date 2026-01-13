from __future__ import annotations

import pickle
from collections.abc import Callable, Mapping
from functools import partial
from typing import TYPE_CHECKING, Any

from arroyo.processing.strategies.abstract import ProcessingStrategy
from arroyo.processing.strategies.run_task import RunTask
from arroyo.processing.strategies.run_task_with_multiprocessing import (
    MultiprocessingPool as ArroyoMultiprocessingPool,
)
from arroyo.processing.strategies.run_task_with_multiprocessing import (
    RunTaskWithMultiprocessing as ArroyoRunTaskWithMultiprocessing,
)
from arroyo.processing.strategies.run_task_with_multiprocessing import TResult
from arroyo.types import Message, TStrategyPayload
from arroyo.utils.metrics import Metrics
from django.conf import settings

if TYPE_CHECKING:
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
        name: str | None = None,
        tags: Tags | None = None,
    ) -> None:
        self.__backend = backend
        self.__name = name
        self.__tags = tags

    def __merge_name(self, name: str) -> str:
        if self.__name is None:
            return name
        else:
            return f"{self.__name}.{name}"

    def __merge_tags(self, tags: Tags | None) -> Tags | None:
        if self.__tags is None:
            return tags
        elif tags is None:
            return self.__tags
        else:
            return {**self.__tags, **tags}

    def increment(
        self,
        name: str,
        value: int | float = 1,
        tags: Tags | None = None,
        stacklevel: int = 0,
    ) -> None:
        # sentry metrics backend uses `incr` instead of `increment`
        self.__backend.incr(
            key=self.__merge_name(name),
            amount=value,
            tags=self.__merge_tags(tags),
            stacklevel=stacklevel + 1,
            sample_rate=1,
        )

    def gauge(
        self,
        name: str,
        value: int | float,
        tags: Tags | None = None,
        stacklevel: int = 0,
    ) -> None:
        self.__backend.gauge(
            key=self.__merge_name(name),
            value=value,
            tags=self.__merge_tags(tags),
            stacklevel=stacklevel + 1,
            sample_rate=1,
        )

    def timing(
        self,
        name: str,
        value: int | float,
        tags: Tags | None = None,
        stacklevel: int = 0,
    ) -> None:
        self.__backend.timing(
            key=self.__merge_name(name),
            value=value,
            tags=self.__merge_tags(tags),
            stacklevel=stacklevel + 1,
            sample_rate=1,
        )


def _get_arroyo_subprocess_initializer(
    initializer: Callable[[], None] | None,
) -> Callable[[], None]:
    from sentry.metrics.middleware import get_current_global_tags

    # One can add integer tags and other invalid types today. Filter out any
    # tags that may not be pickleable. Because those tags are getting pickled
    # as part of the constructed partial()
    tags: Tags = {k: v for k, v in get_current_global_tags().items() if isinstance(v, str)}
    return partial(_initialize_arroyo_subprocess, initializer=initializer, tags=tags)


def _initialize_arroyo_subprocess(initializer: Callable[[], None] | None, tags: Tags) -> None:
    from django.db import close_old_connections

    from sentry.runner import configure

    configure()

    # Close any database connections inherited from the parent process.
    # When forking, child processes inherit file descriptors including database
    # connections. These connections can become stale and cause OperationalError.
    # Django's close_old_connections() properly closes these inherited connections.
    close_old_connections()

    if initializer:
        initializer()

    from sentry.metrics.middleware import add_global_tags

    # Inherit global tags from the parent process
    add_global_tags(all_threads=True, tags=tags)


def initialize_arroyo_main() -> None:
    from arroyo import configure_metrics

    from sentry.utils.metrics import backend

    # XXX: we initially called this function only to initialize sentry consumer
    # metrics, and namespaced arroyo metrics under sentry.consumer. Now we
    # initialize arroyo metrics in every sentry process, and so even producer
    # metrics are namespaced under sentry.consumer.
    metrics_wrapper = MetricsWrapper(backend, name="consumer")
    configure_metrics(metrics_wrapper)


class MultiprocessingPool:
    def __init__(self, num_processes: int, initializer: Callable[[], None] | None = None) -> None:
        self.__initializer = initializer
        if settings.KAFKA_CONSUMER_FORCE_DISABLE_MULTIPROCESSING:
            self.__pool = None
        else:
            self.__pool = ArroyoMultiprocessingPool(
                num_processes, _get_arroyo_subprocess_initializer(initializer)
            )

    @property
    def initializer(self) -> Callable[[], None] | None:
        return self.__initializer

    @property
    def pool(self) -> ArroyoMultiprocessingPool | None:
        return self.__pool

    def close(self) -> None:
        if self.__pool is not None:
            self.__pool.close()


def run_task_with_multiprocessing(
    *,
    pool: MultiprocessingPool,
    function: Callable[[Message[TStrategyPayload]], TResult],
    **kwargs: Any,
) -> (
    RunTask[TStrategyPayload, TResult] | ArroyoRunTaskWithMultiprocessing[TStrategyPayload, TResult]
):
    """
    A variant of arroyo's RunTaskWithMultiprocessing that can switch between
    multiprocessing and non-multiprocessing mode based on the
    `KAFKA_CONSUMER_FORCE_DISABLE_MULTIPROCESSING` setting.
    """

    if settings.KAFKA_CONSUMER_FORCE_DISABLE_MULTIPROCESSING:
        kwargs.pop("num_processes", None)
        kwargs.pop("input_block_size", None)
        kwargs.pop("output_block_size", None)
        kwargs.pop("max_batch_size", None)
        kwargs.pop("max_batch_time", None)

        if pool.initializer is not None:
            pool.initializer()

        # Assert that initializer can be pickled and loaded again from subprocesses.
        pickle.loads(pickle.dumps(pool.initializer))
        pickle.loads(pickle.dumps(function))

        return RunTask(function=function, **kwargs)
    else:
        assert pool.pool is not None

        return ArroyoRunTaskWithMultiprocessing(pool=pool.pool, function=function, **kwargs)


def _import_and_run(
    initializer: Callable[[], None],
    main_fn_pickle: bytes,
    args_pickle: bytes,
    *additional_args: Any,
) -> None:
    initializer()

    # explicitly use pickle so that we can be sure arguments get unpickled
    # after sentry gets initialized
    main_fn = pickle.loads(main_fn_pickle)
    args = pickle.loads(args_pickle)

    main_fn(*args, *additional_args)


def run_with_initialized_sentry(main_fn: Callable[..., None], *args: Any) -> Callable[..., None]:
    main_fn_pickle = pickle.dumps(main_fn)
    args_pickle = pickle.dumps(args)
    return partial(
        _import_and_run, _get_arroyo_subprocess_initializer(None), main_fn_pickle, args_pickle
    )


class SetJoinTimeout(ProcessingStrategy[TStrategyPayload]):
    """
    A strategy for setting and re-setting the join timeout for individual
    sub-sections of the processing chain. This way one can granularly disable
    join() for steps that are idempotent anyway, making rebalancing faster and simpler.
    """

    def __init__(
        self, timeout: float | None, next_step: ProcessingStrategy[TStrategyPayload]
    ) -> None:
        self.timeout = timeout
        self.next_step = next_step

    def submit(self, message: Message[TStrategyPayload]) -> None:
        self.next_step.submit(message)

    def poll(self) -> None:
        self.next_step.poll()

    def join(self, timeout: float | None = None) -> None:
        self.next_step.join(self.timeout)

    def close(self) -> None:
        self.next_step.close()

    def terminate(self) -> None:
        self.next_step.terminate()
