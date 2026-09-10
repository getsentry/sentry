from datetime import datetime, timezone
from enum import IntEnum

import pytest

from sentry.issues.derived.features import IssueStatus
from sentry.issues.derived.framework import (
    AggregatorResult,
    DateTimeCodec,
    EnumCodec,
    Feature,
    OptionalCodec,
    Pipeline,
    Scope,
    State,
    StateUpdate,
    StateView,
    aggregator,
)
from sentry.issues.progress_state import IssueProgressState


class EntryType(IntEnum):
    FIRST = 1
    SECOND = 2
    THIRD = 3


def test_mutation_checking_catches_in_place_mutation() -> None:
    ITEMS = Feature[list[str]]("items", default_factory=list)

    @aggregator((ITEMS,))
    def bad_mutator(state: StateView, entry: object) -> AggregatorResult:
        state[ITEMS].append("oops")
        return None

    p = Pipeline([bad_mutator], check_mutations=True)
    state = p.initial_state()

    class FakeEntry:
        type = 0

    with pytest.raises(RuntimeError, match="mutated feature 'items' in place"):
        p.step(state, FakeEntry())


def test_state_updated_tracks_merged_features() -> None:
    A = Feature[int]("a", default=0)
    B = Feature[int]("b", default=0)
    state = State({A: 0, B: 0})

    assert state.updated == frozenset()

    state.merge(StateUpdate({A: 1}))
    assert state.updated == frozenset({A})
    assert state[A] == 1
    assert state[B] == 0


def test_dependency_scope_must_cover_producer_scope() -> None:
    A = Feature[int]("a", default=0)
    B = Feature[int]("b", default=0)

    @aggregator((A,), scope=(EntryType.FIRST, EntryType.SECOND))
    def produce_a(state: StateView, entry: object) -> AggregatorResult:
        return None

    @aggregator((B,), deps=(A,), scope=(EntryType.FIRST,))
    def use_a(state: StateView, entry: object) -> AggregatorResult:
        return None

    with pytest.raises(ValueError, match="scope that does not cover dependency 'a'"):
        Pipeline([produce_a, use_a])


def test_scoped_aggregator_cannot_depend_on_all_scope_aggregator() -> None:
    A = Feature[int]("a", default=0)
    B = Feature[int]("b", default=0)

    @aggregator((A,))
    def produce_a(state: StateView, entry: object) -> AggregatorResult:
        return None

    @aggregator((B,), deps=(A,), scope=(EntryType.FIRST,))
    def use_a(state: StateView, entry: object) -> AggregatorResult:
        return None

    with pytest.raises(ValueError, match="scope that does not cover dependency 'a'"):
        Pipeline([produce_a, use_a])


def test_dependency_scope_can_be_a_superset_of_producer_scope() -> None:
    A = Feature[int]("a", default=0)
    B = Feature[int]("b", default=0)

    @aggregator((A,), scope=(EntryType.FIRST,))
    def produce_a(state: StateView, entry: object) -> AggregatorResult:
        return None

    @aggregator((B,), deps=(A,), scope=(EntryType.FIRST, EntryType.SECOND))
    def use_a(state: StateView, entry: object) -> AggregatorResult:
        return None

    assert Pipeline([produce_a, use_a]).aggregators == (produce_a, use_a)


def test_all_scope_aggregator_covers_scoped_dependency() -> None:
    A = Feature[int]("a", default=0)
    B = Feature[int]("b", default=0)

    @aggregator((A,), scope=(EntryType.FIRST,))
    def produce_a(state: StateView, entry: object) -> AggregatorResult:
        return None

    @aggregator((B,), deps=(A,))
    def use_a(state: StateView, entry: object) -> AggregatorResult:
        return None

    assert Pipeline([produce_a, use_a]).aggregators == (produce_a, use_a)


def test_default_scope_is_all() -> None:
    A = Feature[int]("a", default=0)

    @aggregator((A,))
    def produce_a(state: StateView, entry: object) -> AggregatorResult:
        return None

    assert produce_a.scope is Scope.ALL


def test_deps_scope_runs_for_union_of_dependency_scopes() -> None:
    A = Feature[int]("a", default=0)
    B = Feature[int]("b", default=0)
    C = Feature[int]("c", default=0)

    @aggregator((A,), scope=(EntryType.FIRST,))
    def produce_a(state: StateView, entry: object) -> AggregatorResult:
        return StateUpdate({A: state[A] + 1})

    @aggregator((B,), scope=(EntryType.SECOND,))
    def produce_b(state: StateView, entry: object) -> AggregatorResult:
        return StateUpdate({B: state[B] + 1})

    @aggregator((C,), deps=(A, B), scope=Scope.DEPS)
    def use_deps(state: StateView, entry: object) -> AggregatorResult:
        return StateUpdate({C: state[C] + 1})

    class Entry:
        def __init__(self, type: EntryType) -> None:
            self.type = type

    state = Pipeline([produce_a, produce_b, use_deps]).run(
        [Entry(EntryType.FIRST), Entry(EntryType.SECOND), Entry(EntryType.THIRD)]
    )

    assert state[A] == 1
    assert state[B] == 1
    assert state[C] == 2


def test_deps_scope_is_resolved_transitively() -> None:
    A = Feature[int]("a", default=0)
    B = Feature[int]("b", default=0)
    C = Feature[int]("c", default=0)

    @aggregator((A,), scope=(EntryType.FIRST,))
    def produce_a(state: StateView, entry: object) -> AggregatorResult:
        return None

    @aggregator((B,), deps=(A,), scope=Scope.DEPS)
    def use_a(state: StateView, entry: object) -> AggregatorResult:
        return None

    @aggregator((C,), deps=(B,), scope=(EntryType.SECOND,))
    def use_b(state: StateView, entry: object) -> AggregatorResult:
        return None

    with pytest.raises(ValueError, match="scope that does not cover dependency 'b'"):
        Pipeline([produce_a, use_a, use_b])


def test_deps_scope_resolves_to_all_when_dependency_scope_is_all() -> None:
    A = Feature[int]("a", default=0)
    B = Feature[int]("b", default=0)

    @aggregator((A,))
    def produce_a(state: StateView, entry: object) -> AggregatorResult:
        return StateUpdate({A: state[A] + 1})

    @aggregator((B,), deps=(A,), scope=Scope.DEPS)
    def use_a(state: StateView, entry: object) -> AggregatorResult:
        return StateUpdate({B: state[B] + 1})

    class Entry:
        type = EntryType.THIRD

    state = Pipeline([produce_a, use_a]).run([Entry()])

    assert state[A] == 1
    assert state[B] == 1


def test_deps_scope_requires_dependency() -> None:
    A = Feature[int]("a", default=0)

    with pytest.raises(ValueError, match="requires at least one dependency"):
        aggregator((A,), scope=Scope.DEPS)


class TestDateTimeCodec:
    def test_json_round_trip(self) -> None:
        codec = DateTimeCodec()
        dt = datetime(2025, 3, 15, 12, 30, 45, tzinfo=timezone.utc)
        assert codec.from_json(codec.to_json(dt)) == dt

    def test_to_json_produces_iso_string(self) -> None:
        codec = DateTimeCodec()
        dt = datetime(2025, 3, 15, 12, 30, 45, tzinfo=timezone.utc)
        dumped = codec.to_json(dt)
        assert isinstance(dumped, str)
        assert dumped == dt.isoformat()

    def test_column_round_trip_is_identity(self) -> None:
        codec = DateTimeCodec()
        dt = datetime(2025, 3, 15, 12, 30, 45, tzinfo=timezone.utc)
        assert codec.from_column(codec.to_column(dt)) == dt
        assert codec.to_column(dt) is dt

    def test_optional_none(self) -> None:
        codec = OptionalCodec(DateTimeCodec())
        assert codec.to_json(None) is None
        assert codec.from_json(None) is None

    def test_optional_json_round_trip(self) -> None:
        codec = OptionalCodec(DateTimeCodec())
        dt = datetime(2025, 3, 15, 12, 30, 45, tzinfo=timezone.utc)
        assert codec.from_json(codec.to_json(dt)) == dt


class TestEnumCodecCoverage:
    @pytest.mark.parametrize("raw", ["open", "closed"])
    def test_issue_status_json_round_trip(self, raw: str) -> None:
        codec = EnumCodec(IssueStatus)
        loaded = codec.from_json(raw)
        assert codec.to_json(loaded) == raw

    @pytest.mark.parametrize("raw", ["open", "closed"])
    def test_issue_status_column_round_trip(self, raw: str) -> None:
        codec = EnumCodec(IssueStatus)
        loaded = codec.from_column(raw)
        assert isinstance(loaded, IssueStatus)
        assert codec.to_column(loaded) == raw

    @pytest.mark.parametrize(
        "raw", ["identified", "assigned", "diagnosed", "fix_proposed", "fix_applied"]
    )
    def test_issue_progress_state_json_round_trip(self, raw: str) -> None:
        codec = EnumCodec(IssueProgressState)
        loaded = codec.from_json(raw)
        assert codec.to_json(loaded) == raw

    @pytest.mark.parametrize(
        "raw", ["identified", "assigned", "diagnosed", "fix_proposed", "fix_applied"]
    )
    def test_issue_progress_state_column_produces_enum(self, raw: str) -> None:
        codec = EnumCodec(IssueProgressState)
        loaded = codec.from_column(raw)
        assert isinstance(loaded, IssueProgressState)

    @pytest.mark.parametrize(
        "raw",
        [None, "identified", "assigned", "diagnosed", "fix_proposed", "fix_applied"],
    )
    def test_optional_progress_json_round_trip(self, raw: str | None) -> None:
        codec = OptionalCodec(EnumCodec(IssueProgressState))
        loaded = codec.from_json(raw)
        assert codec.to_json(loaded) == raw

    @pytest.mark.parametrize(
        "raw",
        [None, "identified", "assigned", "diagnosed", "fix_proposed", "fix_applied"],
    )
    def test_optional_progress_column_round_trip(self, raw: str | None) -> None:
        codec = OptionalCodec(EnumCodec(IssueProgressState))
        loaded = codec.from_column(raw)
        if raw is not None:
            assert isinstance(loaded, IssueProgressState)
        assert codec.to_column(loaded) == raw
