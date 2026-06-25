"""
Pure-Python tests for merge-aware aggregators. No database, no Django TestCase.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sentry.issues.action_log.types import GroupActionType
from sentry.issues.derived.framework import (
    AggregatorResult,
    Feature,
    Pipeline,
    StateView,
    aggregator,
    emit,
)
from sentry.issues.derived.merge import is_merged_entry, merge_aware

VIEWS = Feature[int]("views", default=0)


@dataclass(frozen=True)
class FakeEntry:
    type: int
    group_id: int = 1
    original_group_id: int | None = None
    date_added: datetime = datetime(2025, 1, 1, tzinfo=UTC)


def _pipeline(*aggregators: Any) -> Pipeline[Any]:
    return Pipeline(aggregators, version=1, check_mutations=True)


# ---------------------------------------------------------------------------
# is_merged_entry
# ---------------------------------------------------------------------------


def test_native_entry_is_not_merged() -> None:
    assert not is_merged_entry(FakeEntry(type=GroupActionType.VIEW))


def test_entry_with_matching_original_is_not_merged() -> None:
    assert not is_merged_entry(
        FakeEntry(type=GroupActionType.VIEW, group_id=7, original_group_id=7)
    )


def test_entry_from_other_group_is_merged() -> None:
    assert is_merged_entry(FakeEntry(type=GroupActionType.VIEW, group_id=7, original_group_id=99))


# ---------------------------------------------------------------------------
# merge_aware
# ---------------------------------------------------------------------------


def _views_merged(state: StateView, entry: FakeEntry) -> AggregatorResult:
    # Merged-in views are worth half as much (rounded down).
    return emit(VIEWS.value(state[VIEWS]))


@aggregator((VIEWS,), scope=(GroupActionType.VIEW,))
@merge_aware(_views_merged)
def track_views(state: StateView, entry: FakeEntry) -> AggregatorResult:
    return emit(VIEWS.value(state[VIEWS] + 1))


def test_native_entries_use_default_branch() -> None:
    state = _pipeline(track_views).run(
        [
            FakeEntry(type=GroupActionType.VIEW),
            FakeEntry(type=GroupActionType.VIEW),
        ]
    )
    assert state[VIEWS] == 2


def test_merged_entries_use_merged_branch() -> None:
    state = _pipeline(track_views).run(
        [
            FakeEntry(type=GroupActionType.VIEW, group_id=1, original_group_id=2),
            FakeEntry(type=GroupActionType.VIEW, group_id=1, original_group_id=2),
        ]
    )
    assert state[VIEWS] == 0


def test_mixed_entries_dispatch_per_entry() -> None:
    state = _pipeline(track_views).run(
        [
            FakeEntry(type=GroupActionType.VIEW),  # native -> +1
            FakeEntry(type=GroupActionType.VIEW, group_id=1, original_group_id=2),  # merged -> noop
            FakeEntry(type=GroupActionType.VIEW),  # native -> +1
        ]
    )
    assert state[VIEWS] == 2


def test_preserves_aggregator_name() -> None:
    # @functools.wraps keeps the name so the Pipeline sees `track_views`, not `wrapper`.
    assert track_views.name == "track_views"


def test_custom_predicate() -> None:
    @aggregator((VIEWS,), scope=(GroupActionType.VIEW,))
    @merge_aware(_views_merged, predicate=lambda entry: True)
    def always_merged(state: StateView, entry: FakeEntry) -> AggregatorResult:
        return emit(VIEWS.value(state[VIEWS] + 1))

    state = _pipeline(always_merged).run([FakeEntry(type=GroupActionType.VIEW)])
    assert state[VIEWS] == 0
