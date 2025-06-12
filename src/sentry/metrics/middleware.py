from collections.abc import Generator
from contextlib import contextmanager
from threading import local

from django.conf import settings

from sentry.metrics.base import MetricsBackend, MutableTags, Tags, TagValue

_BAD_TAGS = frozenset(["event", "project", "group"])
_NOT_BAD_TAGS = frozenset(["use_case_id"])
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


class BadMetricTags(RuntimeError):
    pass


def _filter_tags(key: str, tags: MutableTags) -> MutableTags:
    """Removes unwanted tags from the tag mapping and returns a filtered one."""
    if key in _METRICS_THAT_CAN_HAVE_BAD_TAGS:
        return tags

    discarded = frozenset(
        key
        for key in tags
        if key not in _NOT_BAD_TAGS and (key.endswith("_id") or key in _BAD_TAGS)
    )
    if not discarded:
        return tags

    if settings.SENTRY_METRICS_DISALLOW_BAD_TAGS:
        raise BadMetricTags(
            f"discarded illegal metric tags: {sorted(discarded)} for metric {key!r}"
        )
    return {k: v for k, v in tags.items() if k not in discarded}


_THREAD_LOCAL_TAGS = local()
_GLOBAL_TAGS: list[Tags] = []


def _add_global_tags(_all_threads: bool = False, **tags: TagValue) -> list[Tags]:
    if _all_threads:
        stack = _GLOBAL_TAGS
    else:
        if not hasattr(_THREAD_LOCAL_TAGS, "stack"):
            stack = _THREAD_LOCAL_TAGS.stack = []
        else:
            stack = _THREAD_LOCAL_TAGS.stack

    stack.append(tags)
    return stack


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
def global_tags(_all_threads: bool = False, **tags: TagValue) -> Generator[None]:
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


def get_current_global_tags() -> MutableTags:
    rv: MutableTags = {}

    for tags in _GLOBAL_TAGS:
        rv.update(tags)

    for tags in getattr(_THREAD_LOCAL_TAGS, "stack", None) or ():
        rv.update(tags)

    return rv


class MiddlewareWrapper(MetricsBackend):
    """
    A wrapper around any metrics backend implementing tags denylisting and global tag context.
    """

    def __init__(self, inner: MetricsBackend) -> None:
        self.inner = inner

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
        current_tags = get_current_global_tags()
        if tags is not None:
            current_tags.update(tags)
        current_tags = _filter_tags(key, current_tags)

        return self.inner.incr(
            key, instance, current_tags, amount, sample_rate, unit, stacklevel + 1
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
        current_tags = get_current_global_tags()
        if tags is not None:
            current_tags.update(tags)
        current_tags = _filter_tags(key, current_tags)

        return self.inner.timing(key, value, instance, current_tags, sample_rate, stacklevel + 1)

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
        current_tags = get_current_global_tags()
        if tags is not None:
            current_tags.update(tags)
        current_tags = _filter_tags(key, current_tags)

        return self.inner.gauge(
            key, value, instance, current_tags, sample_rate, unit, stacklevel + 1
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
        current_tags = get_current_global_tags()
        if tags is not None:
            current_tags.update(tags)
        current_tags = _filter_tags(key, current_tags)

        return self.inner.distribution(
            key, value, instance, current_tags, sample_rate, unit, stacklevel + 1
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
        current_tags = get_current_global_tags()
        if tags is not None:
            current_tags.update(tags)

        return self.inner.event(
            title,
            message,
            alert_type,
            aggregation_key,
            source_type_name,
            priority,
            instance,
            current_tags,
            stacklevel + 1,
        )
