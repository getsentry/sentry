__all__ = ["timing", "incr"]


import functools
import logging
import time
from contextlib import contextmanager
from queue import Queue
from random import random
from threading import Thread, local
from typing import (
    Any,
    Callable,
    Generator,
    List,
    Mapping,
    MutableMapping,
    Optional,
    Tuple,
    TypeVar,
    Union,
)

from django.conf import settings

from sentry.metrics.base import MetricsBackend

metrics_skip_all_internal = getattr(settings, "SENTRY_METRICS_SKIP_ALL_INTERNAL", False)
metrics_skip_internal_prefixes = tuple(settings.SENTRY_METRICS_SKIP_INTERNAL_PREFIXES)

_BAD_TAGS = frozenset(["event", "project", "group"])
_METRICS_THAT_CAN_HAVE_BAD_TAGS = frozenset(
    [
        # snuba related tags
        "process_message",
        "commit_log_msg_latency",
        "commit_log_latency",
        "process_message.normalized",
        "batching_consumer.batch.size",
        "batching_consumer.batch.flush",
        "batching_consumer.batch.flush.normalized",
    ]
)

T = TypeVar("T")
F = TypeVar("F", bound=Callable[..., Any])

# Note: One can pass a lot without TypeErrors, but some values such as None
# don't actually get serialized as tags properly all the way to statsd (they
# just get lost)
# We still loosely type here because we have too many places where we send None
# for a tag value, and sometimes even keys. It doesn't cause real bugs, your
# monitoring is just slightly broken.
TagValue = Union[str, int, float, None]
Tags = Mapping[str, TagValue]
MutableTags = MutableMapping[str, TagValue]

_THREAD_LOCAL_TAGS = local()
_GLOBAL_TAGS: List[Tags] = []


def _add_global_tags(_all_threads: bool = False, **tags: TagValue) -> List[Tags]:
    if _all_threads:
        stack = _GLOBAL_TAGS
    else:
        if not hasattr(_THREAD_LOCAL_TAGS, "stack"):
            stack = _THREAD_LOCAL_TAGS.stack = []
        else:
            stack = _THREAD_LOCAL_TAGS.stack

    stack.append(tags)
    return stack


class BadMetricTags(RuntimeError):
    pass


def _filter_tags(key: str, tags: MutableTags) -> MutableTags:
    """Removes unwanted tags from the tag mapping and returns a filtered one."""
    if key in _METRICS_THAT_CAN_HAVE_BAD_TAGS:
        return tags

    discarded = frozenset(key for key in tags if key.endswith("_id") or key in _BAD_TAGS)
    if not discarded:
        return tags

    if settings.SENTRY_METRICS_DISALLOW_BAD_TAGS:
        raise BadMetricTags(
            f"discarded illegal metric tags: {sorted(discarded)} for metric {key!r}"
        )
    return {k: v for k, v in tags.items() if k not in discarded}


def add_global_tags(_all_threads: bool = False, **tags: TagValue) -> None:
    """
    Set multiple metric tags onto the global or thread-local stack which then
    apply to all metrics.

    When used in combination with the `global_tags` context manager,
    `add_global_tags` is reverted in any wrapping invocaation of `global_tags`.
    For example::

        with global_tags(tag_a=123):
            add_global_tags(tag_b=123)

        # tag_b is no longer visible
    """
    _add_global_tags(_all_threads=_all_threads, **tags)


@contextmanager
def global_tags(_all_threads: bool = False, **tags: TagValue) -> Generator[None, None, None]:
    """
    The context manager version of `add_global_tags` that reverts all tag
    changes upon exit.

    See docstring of `add_global_tags` for how those two methods interact.
    """
    stack = _add_global_tags(_all_threads=_all_threads, **tags)
    old_len = len(stack) - 1

    try:
        yield
    finally:
        del stack[old_len:]


def _get_current_global_tags() -> MutableTags:
    rv: MutableTags = {}

    for tags in _GLOBAL_TAGS:
        rv.update(tags)

    for tags in getattr(_THREAD_LOCAL_TAGS, "stack", None) or ():
        rv.update(tags)

    return rv


def get_default_backend() -> MetricsBackend:
    from sentry.utils.imports import import_string

    cls = import_string(settings.SENTRY_METRICS_BACKEND)

    return cls(**settings.SENTRY_METRICS_OPTIONS)


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
    current_tags = _get_current_global_tags()
    if tags is not None:
        current_tags.update(tags)
    current_tags = _filter_tags(key, current_tags)

    should_send_internal = (
        not metrics_skip_all_internal
        and not skip_internal
        and _should_sample(sample_rate)
        and not key.startswith(metrics_skip_internal_prefixes)
    )

    if should_send_internal:
        internal.incr(key, instance, current_tags, amount, sample_rate)

    try:
        backend.incr(key, instance, current_tags, amount, sample_rate)
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
    current_tags = _get_current_global_tags()
    if tags is not None:
        current_tags.update(tags)
    current_tags = _filter_tags(key, current_tags)

    try:
        backend.gauge(key, value, instance, current_tags, sample_rate)
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
    current_tags = _get_current_global_tags()
    if tags is not None:
        current_tags.update(tags)
    current_tags = _filter_tags(key, current_tags)

    try:
        backend.timing(key, value, instance, current_tags, sample_rate)
    except Exception:
        logger = logging.getLogger("sentry.errors")
        logger.exception("Unable to record backend metric")


def histogram(
    key: str,
    value: Union[int, float],
    instance: Optional[str] = None,
    tags: Optional[Tags] = None,
    sample_rate: float = settings.SENTRY_METRICS_SAMPLE_RATE,
) -> None:
    current_tags = _get_current_global_tags()
    if tags is not None:
        current_tags.update(tags)
    current_tags = _filter_tags(key, current_tags)

    try:
        backend.histogram(key, value, instance, current_tags, sample_rate)
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
    current_tags = _get_current_global_tags()
    if tags is not None:
        current_tags.update(tags)
    current_tags = _filter_tags(key, current_tags)

    start = time.monotonic()
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
