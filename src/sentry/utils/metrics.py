__all__ = ["timing", "incr"]


import functools
import logging
import time
from contextlib import contextmanager
from queue import Queue
from random import random
from threading import Thread
from typing import Any, Callable, Generator, Optional, Tuple, Type, TypeVar, Union

from django.conf import settings

from sentry.metrics.base import MetricsBackend, MutableTags, Tags
from sentry.metrics.middleware import MiddlewareWrapper, add_global_tags, global_tags

metrics_skip_all_internal = getattr(settings, "SENTRY_METRICS_SKIP_ALL_INTERNAL", False)
metrics_skip_internal_prefixes = tuple(settings.SENTRY_METRICS_SKIP_INTERNAL_PREFIXES)

__all__ = [
    "add_global_tags",
    "global_tags",
    "incr",
    "timer",
    "timing",
    "gauge",
    "backend",
    "MutableTags",
]


T = TypeVar("T")
F = TypeVar("F", bound=Callable[..., Any])


def get_default_backend() -> MetricsBackend:
    from sentry.utils.imports import import_string

    cls: Type[MetricsBackend] = import_string(settings.SENTRY_METRICS_BACKEND)

    return MiddlewareWrapper(cls(**settings.SENTRY_METRICS_OPTIONS))


backend = get_default_backend()


def _get_key(key: str) -> str:
    prefix = settings.SENTRY_METRICS_PREFIX
    if prefix:
        return f"{prefix}{key}"
    return key


def _should_sample(sample_rate: float) -> bool:
    return sample_rate >= 1 or random() >= 1 - sample_rate


def _sampled_value(value: Union[int, float], sample_rate: float) -> Union[int, float]:
    if sample_rate < 1:
        value = int(value * (1.0 / sample_rate))
    return value


class InternalMetrics:
    def __init__(self) -> None:
        self._started = False

    def _start(self) -> None:
        q: Queue[Tuple[str, Optional[str], Optional[Tags], Union[float, int], float]]
        self.q = q = Queue()

        def worker() -> None:
            from sentry import tsdb

            while True:
                key, instance, tags, amount, sample_rate = q.get()
                amount = _sampled_value(amount, sample_rate)
                if instance:
                    full_key = f"{key}.{instance}"
                else:
                    full_key = key
                try:
                    tsdb.incr(tsdb.models.internal, full_key, count=amount)
                except Exception:
                    logger = logging.getLogger("sentry.errors")
                    logger.exception("Unable to incr internal metric")
                finally:
                    q.task_done()

        t = Thread(target=worker)
        t.setDaemon(True)
        t.start()

        self._started = True

    def incr(
        self,
        key: str,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        amount: int = 1,
        sample_rate: float = settings.SENTRY_METRICS_SAMPLE_RATE,
    ) -> None:
        if not self._started:
            self._start()
        self.q.put((key, instance, tags, amount, sample_rate))


internal = InternalMetrics()


def incr(
    key: str,
    amount: int = 1,
    instance: Optional[str] = None,
    tags: Optional[Tags] = None,
    skip_internal: bool = True,
    sample_rate: float = settings.SENTRY_METRICS_SAMPLE_RATE,
) -> None:
    should_send_internal = (
        not metrics_skip_all_internal
        and not skip_internal
        and _should_sample(sample_rate)
        and not key.startswith(metrics_skip_internal_prefixes)
    )

    if should_send_internal:
        internal.incr(key, instance, tags, amount, sample_rate)

    try:
        backend.incr(key, instance, tags, amount, sample_rate)
        if should_send_internal:
            backend.incr("internal_metrics.incr", key, None, 1, sample_rate)
    except Exception:
        logger = logging.getLogger("sentry.errors")
        logger.exception("Unable to record backend metric")


def gauge(
    key: str,
    value: float,
    instance: Optional[str] = None,
    tags: Optional[Tags] = None,
    sample_rate: float = settings.SENTRY_METRICS_SAMPLE_RATE,
) -> None:
    try:
        backend.gauge(key, value, instance, tags, sample_rate)
    except Exception:
        logger = logging.getLogger("sentry.errors")
        logger.exception("Unable to record backend metric")


def timing(
    key: str,
    value: Union[int, float],
    instance: Optional[str] = None,
    tags: Optional[Tags] = None,
    sample_rate: float = settings.SENTRY_METRICS_SAMPLE_RATE,
) -> None:
    try:
        backend.timing(key, value, instance, tags, sample_rate)
    except Exception:
        logger = logging.getLogger("sentry.errors")
        logger.exception("Unable to record backend metric")


@contextmanager
def timer(
    key: str,
    instance: Optional[str] = None,
    tags: Optional[Tags] = None,
    sample_rate: float = settings.SENTRY_METRICS_SAMPLE_RATE,
) -> Generator[MutableTags, None, None]:
    start = time.monotonic()
    current_tags: MutableTags = dict(tags or ())
    try:
        yield current_tags
    except Exception:
        current_tags["result"] = "failure"
        raise
    else:
        current_tags["result"] = "success"
    finally:
        timing(key, time.monotonic() - start, instance, current_tags, sample_rate)


def wraps(
    key: str,
    instance: Optional[str] = None,
    tags: Optional[Tags] = None,
    sample_rate: float = settings.SENTRY_METRICS_SAMPLE_RATE,
) -> Callable[[F], F]:
    def wrapper(f: F) -> F:
        @functools.wraps(f)
        def inner(*args: Any, **kwargs: Any) -> Any:
            with timer(key, instance=instance, tags=tags, sample_rate=sample_rate):
                return f(*args, **kwargs)

        return inner  # type: ignore

    return wrapper
