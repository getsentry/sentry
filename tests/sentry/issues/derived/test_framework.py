from datetime import datetime, timezone

import pytest

from sentry.issues.derived.features import IssueStatus
from sentry.issues.derived.framework import (
    AggregatorResult,
    DateTimeCodec,
    EnumCodec,
    Feature,
    OptionalCodec,
    Pipeline,
    State,
    StateUpdate,
    StateView,
    aggregator,
)
from sentry.issues.progress_state import IssueProgressState


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
