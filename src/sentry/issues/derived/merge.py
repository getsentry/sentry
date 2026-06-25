"""
Helpers for writing merge-aware aggregators.

When groups are merged, the canonical group's action log absorbs entries that
originally belonged to other groups. Such entries carry an original_group_id
that differs from their (post-merge) group_id. Some aggregators want to fold
those entries differently from native ones; merge_aware packages that
dispatch so each aggregator doesn't have to repeat it.
"""

from __future__ import annotations

import functools
from collections.abc import Callable

from sentry.issues.derived.framework import AggregatorResult, StateView
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry

type EntryFn = Callable[[StateView, GroupActionLogEntry], AggregatorResult]


def is_merged_entry(entry: GroupActionLogEntry) -> bool:
    """
    True when this entry came from a group merged into the canonical one.
    """
    return entry.original_group_id is not None and entry.original_group_id != entry.group_id


def merge_aware(
    merged_fn: EntryFn,
    *,
    predicate: Callable[[GroupActionLogEntry], bool] = is_merged_entry,
) -> Callable[[EntryFn], EntryFn]:
    """
    Dispatch to merged_fn for merged-in entries, else the default fn.

    Apply *below* ``@aggregator`` so the wrapped value is still a plain
    ``AggregatorFn``::

        @aggregator((VIEW_COUNT,), scope=(GroupActionType.VIEW,))
        @merge_aware(_track_views_merged)
        def track_views(state, entry):
            return emit(VIEW_COUNT.value(state[VIEW_COUNT] + 1))

    Both branches share the aggregator's declared deps/outputs, so
    merged_fn may only read and write features the aggregator already
    declares — the ``StateView`` rejects anything else.
    """

    def decorator(default_fn: EntryFn) -> EntryFn:
        @functools.wraps(default_fn)  # preserves __name__ -> Aggregator.name
        def wrapper(state: StateView, entry: GroupActionLogEntry) -> AggregatorResult:
            if predicate(entry):
                return merged_fn(state, entry)
            return default_fn(state, entry)

        return wrapper

    return decorator
