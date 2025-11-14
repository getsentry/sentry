"""Low-overhead, context-scoped statistics collection.

Provides utilities to record counters, timings, and custom metrics within
specific execution contexts with minimal performance impact when not recording.
"""

from __future__ import annotations

import functools
import time
from collections import defaultdict
from collections.abc import Callable, Generator
from contextlib import contextmanager
from contextvars import ContextVar
from typing import ParamSpec, TypeVar, int

_current_collector: ContextVar[_StatsCollector | None] = ContextVar(
    "current_collector", default=None
)

T = TypeVar("T")
P = ParamSpec("P")
Tags = dict[str, str | bool]


def _generate_tags_key(tags: Tags | None) -> tuple[tuple[str, str | bool], ...]:
    """Generate a consistent, immutable key from tags without caching."""
    if not tags:
        return ()
    return tuple(sorted(tags.items()))


def _get_filtered_stats(
    data: dict[str, dict[tuple[tuple[str, str | bool], ...], int | float]],
    tag_filter: Tags | None,
) -> dict[str, int | float]:
    """Shared logic for filtering stats by tags."""
    result: dict[str, int | float] = {}
    filter_items = set(tag_filter.items()) if tag_filter else None

    for key, tags_data in data.items():
        total: int | float = 0
        for tags_tuple, count in tags_data.items():
            if filter_items is None or filter_items.issubset(set(tags_tuple)):
                total += count
        if total > 0 or filter_items is None:
            result[key] = total

    return result


class _StatsCollector:
    """Temporary collector for stats within a context."""

    __slots__ = ("_data",)

    def __init__(self) -> None:
        self._data: dict[str, dict[tuple[tuple[str, str | bool], ...], int | float]] = defaultdict(
            lambda: defaultdict(int)
        )

    def increment(self, key: str, tags: Tags | None = None, amount: int | float = 1) -> None:
        tags_tuple = _generate_tags_key(tags)
        self._data[key][tags_tuple] += amount

    def set(self, key: str, tags: Tags | None = None, value: int | float = 0) -> None:
        tags_tuple = _generate_tags_key(tags)
        self._data[key][tags_tuple] = value

    def merge_into(self, target: _StatsCollector) -> None:
        """Merge this collector's data into another collector."""
        for key, tags_data in self._data.items():
            target_key_data = target._data[key]
            for tags_tuple, amount in tags_data.items():
                target_key_data[tags_tuple] += amount


class Recorder:
    """Records statistics during context blocks. Use with record() context manager."""

    __slots__ = ("_data", "_has_recorded")

    def __init__(self) -> None:
        self._data: dict[str, dict[tuple[tuple[str, str | bool], ...], int | float]] = defaultdict(
            lambda: defaultdict(int)
        )
        self._has_recorded = False

    @contextmanager
    def record(self) -> Generator[None]:
        """Context manager for recording statistics. Automatically adds total_recording_duration."""
        collector = _StatsCollector()
        parent_collector = _current_collector.get()
        context_token = _current_collector.set(collector)

        start_time = time.perf_counter()

        try:
            yield
        finally:
            end_time = time.perf_counter()
            recording_duration = end_time - start_time

            collector.set("total_recording_duration", value=recording_duration)

            self._merge_collector(collector)
            self._has_recorded = True

            _current_collector.reset(context_token)

            if parent_collector is not None:
                collector.merge_into(parent_collector)

    def _merge_collector(self, collector: _StatsCollector) -> None:
        for key, tags_data in collector._data.items():
            final_key_data = self._data[key]
            for tags_tuple, amount in tags_data.items():
                final_key_data[tags_tuple] += amount

    def get_result(
        self, tag_filter: Tags | None = None, *, require_recording: bool = False
    ) -> dict[str, int | float]:
        """Get recorded statistics.

        Args:
            tag_filter: Only include stats with matching tags
            require_recording: Raise ValueError if no recording has occurred
        """
        if require_recording and not self._has_recorded:
            raise ValueError(
                "No recording has occurred. Use recorder.record() context manager first."
            )
        return _get_filtered_stats(self._data, tag_filter)


def incr(key: str, tags: Tags | None = None, amount: int | float = 1) -> None:
    """Increment a counter if stats are being recorded."""
    collector = _current_collector.get()
    if collector:
        tags_tuple = _generate_tags_key(tags)
        collector._data[key][tags_tuple] += amount


def timer(
    *,
    key: str | None = None,
    tags: Tags | None = None,
) -> Callable[[Callable[P, T]], Callable[P, T]]:
    """Decorator to time function execution and record statistics if stats are being recorded.

    Records two keys:
    - {key}.count: Number of calls
    - {key}.total_dur: Total duration in seconds

    Default key is "calls.{func.__qualname__}".
    """

    def create_wrapper(f: Callable[P, T]) -> Callable[P, T]:
        timer_key = key if key is not None else f"calls.{f.__qualname__}"
        tags_tuple = _generate_tags_key(tags)

        @functools.wraps(f)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            collector = _current_collector.get()
            if not collector:
                return f(*args, **kwargs)

            start_time = time.perf_counter()
            try:
                return f(*args, **kwargs)
            finally:
                duration_secs = time.perf_counter() - start_time

                collector._data[f"{timer_key}.count"][tags_tuple] += 1
                collector._data[f"{timer_key}.total_dur"][tags_tuple] += duration_secs

        return wrapper

    return create_wrapper
