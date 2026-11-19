import zlib
from collections import Counter, deque
from collections.abc import Sequence
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from math import copysign, inf
from random import Random
from unittest.mock import patch

import pytest

from sentry import options
from sentry.anomaly_detection import schedule
from sentry.anomaly_detection.checkpoint import codec
from sentry.anomaly_detection.checkpoint.replay import advance_org, snapshot
from sentry.anomaly_detection.checkpoint.retention import evict_stale_series, history_floor
from sentry.anomaly_detection.contracts import (
    ChangeEvent,
    ChangeType,
    Metric,
    NoveltyEvidence,
    SeriesKey,
    SeriesRow,
    Service,
    Signal,
    Urgency,
)
from sentry.anomaly_detection.correlation.correlator import MemberState, episode_key
from sentry.anomaly_detection.correlation.footprint import CallEdge, Footprint, Slice, SliceStats
from sentry.anomaly_detection.correlation.shared_dependencies import DependencySlice, PairStats
from sentry.anomaly_detection.evaluation.count_windows import DISPERSION_MIN, CountTotals
from sentry.anomaly_detection.evaluation.organization import (
    AnomalyDecision,
    Checkpoint,
    OrgEvaluator,
)
from sentry.anomaly_detection.evaluation.series import samples_key
from sentry.anomaly_detection.inputs.measurements import MAX_ENVIRONMENTS, MAX_SLICES, SPAN_SLICES
from sentry.anomaly_detection.inputs.trace_lookup import TraceLookup
from sentry.models.anomaly_detection_state import AnomalyDetectionState
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import cell_silo_test
from sentry.workflow_engine.types import DetectorType

START = datetime(2024, 1, 8, 12)
PROJECT = 42
ENV = "production"
ENDPOINT = "/checkout"
LATENCY = SeriesKey(PROJECT, ENV, Signal.ENDPOINTS, Metric.P95_DURATION, ENDPOINT)


class Footprints:
    def footprint(self, event: ChangeEvent, observation_end: datetime, /) -> Footprint:
        return Footprint(
            slices={
                Slice(Service(PROJECT, ENV), Signal.ENDPOINTS, ENDPOINT): SliceStats(0.5, 400.0)
            },
            edges=Counter({CallEdge(Service(PROJECT, ENV), "example.com", Service(43, ENV)): 1}),
        )


def _at(minute: int) -> datetime:
    return START + timedelta(minutes=minute)


def _round_trip(checkpoint: Checkpoint) -> Checkpoint:
    restored = codec.decode(codec.encode(checkpoint))
    assert restored is not None
    return restored


def _endpoint_rows(
    start: int, stop: int, *, slow_until: int = 156, normal: float = 100.0
) -> list[SeriesRow]:
    return [
        SeriesRow(_at(i), Signal.ENDPOINTS, metric, PROJECT, ENV, ENDPOINT, value)
        for i in range(start, stop)
        for metric, value in (
            (Metric.COUNT_SAMPLE, 100.0),
            (Metric.P95_DURATION, 400.0 if 120 <= i < slow_until else normal),
        )
    ]


def _endpoint_hourly() -> list[SeriesRow]:
    return [
        SeriesRow(ts, Signal.ENDPOINTS, metric, PROJECT, ENV, ENDPOINT, value)
        for hour in range(12, 16)
        for day in range(1, 15)
        for ts in [START.replace(hour=hour) - timedelta(days=day)]
        for metric, value in ((Metric.COUNT_SAMPLE, 6000.0), (Metric.P95_DURATION, 100.0))
    ]


def test_split_slowdown_matches_continuous_activation_and_resolution() -> None:
    hourly = _endpoint_hourly()
    continuous = OrgEvaluator(Footprints(), projects=(PROJECT,)).advance(
        rows=_endpoint_rows(0, 200),
        hourly_rows=hourly,
        start=START,
        end=_at(200),
    )
    assert [decision.is_resolved for decision in continuous] == [False, True]
    opened, closed = continuous
    assert opened.urgency == Urgency.MEDIUM
    assert opened.group_key == closed.group_key
    assert opened.evidence == closed.evidence

    checkpoint: Checkpoint | None = None
    split: list[AnomalyDecision] = []
    # Before detection persistence, after detection but before public qualification,
    # after qualification, and after observed recovery but before the quiet close.
    for start, stop in zip((0, 121, 145, 158, 179), (121, 145, 158, 179, 200), strict=True):
        decisions, checkpoint = advance_org(
            rows=_endpoint_rows(start, stop),
            hourly_rows=hourly,
            start=_at(start),
            end=_at(stop),
            footprints=Footprints(),
            projects=(PROJECT,),
            checkpoint=checkpoint,
        )
        checkpoint = _round_trip(checkpoint)
        split.extend(decisions)
    assert split == list(continuous)
    assert checkpoint is not None
    assert checkpoint.state.published.keys() == {opened.group_key}


def test_shared_change_event_identity_survives_round_trip() -> None:
    _, checkpoint = advance_org(
        rows=_endpoint_rows(0, 158),
        hourly_rows=_endpoint_hourly(),
        start=START,
        end=_at(158),
        footprints=Footprints(),
        projects=(PROJECT,),
    )
    restored = _round_trip(checkpoint)

    event = restored.state.series_history.series_states[LATENCY].open
    assert event is not None
    (group,) = restored.state.correlation.open_groups.values()
    assert group.root is event
    assert group.members[episode_key(event)].event is event


@pytest.mark.parametrize(
    ("recovery_level", "override_hours"),
    # The 15:00 level is 250. Fresh hourly measurements at the same timestamps must
    # override carried support.
    ((250.0, ()), (1000.0, (15,))),
    ids=("carried-support", "fresh-override"),
)
def test_restored_slowdown_uses_seasonal_history_when_hourly_top_slices_change(
    recovery_level: float, override_hours: tuple[int, ...]
) -> None:
    # The normal level changes from 100 to 250 at 15:00. A fixed-scale
    # fallback would still see normal 15:00 latency as a slowdown.
    hourly: list[SeriesRow] = [
        SeriesRow(ts, Signal.ENDPOINTS, metric, PROJECT, ENV, ENDPOINT, value)
        for hour in range(12, 16)
        for day in range(1, 16)  # Includes an out-of-window day.
        for ts in [START.replace(hour=hour) - timedelta(days=day)]
        for metric, value in (
            (Metric.COUNT_SAMPLE, 6000.0),
            (Metric.P95_DURATION, 250.0 if hour == 15 else 100.0),
        )
    ]
    opening_rows = _endpoint_rows(0, 180, slow_until=180)
    recovery_rows = _endpoint_rows(180, 230, normal=recovery_level)
    fresh = [
        SeriesRow(ts, signal, metric, project, env, "/other", value)
        for ts, signal, metric, project, env, _, value in hourly
    ] + [
        row._replace(value=recovery_level if row.metric == Metric.P95_DURATION else row.value)
        for row in hourly
        if row.ts.hour in override_hours
    ]
    # This bucket was not closed at the split and must not be persisted then.
    latest: list[SeriesRow] = [
        SeriesRow(_at(180), signal, metric, project, env, dim, 10_000.0)
        for ts, signal, metric, project, env, dim, _ in hourly
        if ts == _at(180) - timedelta(days=1)
    ]
    continuous = OrgEvaluator(Footprints(), projects=(PROJECT,)).advance(
        rows=[*opening_rows, *recovery_rows],
        hourly_rows=[*hourly, *latest, *fresh],
        start=START,
        end=_at(230),
    )
    assert [decision.is_resolved for decision in continuous] == [False, True]

    opens, checkpoint = advance_org(
        rows=opening_rows,
        hourly_rows=[*hourly, *latest],
        start=START,
        end=_at(180),
        footprints=Footprints(),
        projects=(PROJECT,),
    )
    checkpoint = _round_trip(checkpoint)
    assert checkpoint.hourly == {
        LATENCY: {
            ts: value
            for ts, _, metric, _, _, _, value in hourly
            if metric == LATENCY.metric and ts.date() >= (START - timedelta(days=14)).date()
        }
    }

    closes, checkpoint = advance_org(
        rows=recovery_rows,
        hourly_rows=fresh,
        start=_at(180),
        end=_at(230),
        footprints=Footprints(),
        projects=(PROJECT,),
        checkpoint=checkpoint,
    )
    assert [*opens, *closes] == list(continuous)
    assert not checkpoint.hourly


def test_split_during_change_point_persistence_and_open_episode() -> None:
    def rows(start: int, stop: int) -> list[SeriesRow]:
        # A 1.45x increase is large enough for CP without opening a 1.5x spike.
        return [
            SeriesRow(_at(i), signal, metric, PROJECT, ENV, "", value)
            for i in range(start, stop)
            for signal, metric, value in (
                (Signal.REQUESTS, Metric.COUNT, 10000.0),
                (Signal.REQUESTS, Metric.COUNT_SAMPLE, 5000.0),
                (Signal.ERRORS, Metric.COUNT, 145.0 if 140 <= i < 205 else 100.0),
            )
        ]

    expected, _ = advance_org(
        rows=rows(0, 250),
        hourly_rows=(),
        start=START,
        end=_at(250),
        footprints=Footprints(),
        projects=(PROJECT,),
    )
    assert [decision.is_resolved for decision in expected] == [False, True]
    assert expected[0].evidence["change_type"] == ChangeType.CHANGE_POINT

    before_open, checkpoint = advance_org(
        rows=rows(0, 166),
        hourly_rows=(),
        start=START,
        end=_at(166),
        footprints=Footprints(),
        projects=(PROJECT,),
    )
    opened, checkpoint = advance_org(
        rows=rows(166, 180),
        hourly_rows=(),
        start=_at(166),
        end=_at(180),
        footprints=Footprints(),
        projects=(PROJECT,),
        checkpoint=_round_trip(checkpoint),
    )
    closed, _ = advance_org(
        rows=rows(180, 250),
        hourly_rows=(),
        start=_at(180),
        end=_at(250),
        footprints=Footprints(),
        projects=(PROJECT,),
        checkpoint=_round_trip(checkpoint),
    )
    assert not before_open
    assert [*opened, *closed] == list(expected)


def test_closed_group_can_continue_with_pending_issue_after_restart() -> None:
    def issue(start: int, detected: int) -> ChangeEvent:
        return ChangeEvent(
            key=SeriesKey(PROJECT, ENV, Signal.NEW_ISSUE, Metric.COUNT_UNIQUE_USER, "123"),
            change_type=ChangeType.NEW_FAILURE_MODE,
            start=_at(start),
            detected_at=_at(detected),
            actual=10.0,
            expected=10.0,
            confidence=0.9,
            issue_ids=(123,),
        )

    # The second episode started near the first recovery but wasn't known until the
    # original group closed. The restore must retain both the queue and the old route.
    issues = [issue(0, 0), issue(34, 47)]
    initial, checkpoint = advance_org(
        rows=(),
        hourly_rows=(),
        start=START,
        end=_at(46),
        footprints=Footprints(),
        projects=(PROJECT,),
        new_issues=issues,
    )
    assert [decision.is_resolved for decision in initial] == [False, True]
    checkpoint = _round_trip(checkpoint)
    (pending,) = checkpoint.state.pending_issues
    assert pending.issue_ids == (123,)
    continued, checkpoint = advance_org(
        rows=(),
        hourly_rows=(),
        start=_at(46),
        end=_at(94),
        footprints=Footprints(),
        projects=(PROJECT,),
        checkpoint=checkpoint,
    )
    continuous = OrgEvaluator(Footprints(), projects=(PROJECT,)).advance(
        rows=(),
        hourly_rows=(),
        start=START,
        end=_at(94),
        new_issues=issues,
    )
    assert [decision.is_resolved for decision in continued] == [False, True]
    assert [*initial, *continued] == list(continuous)
    assert {decision.group_key for decision in continuous} == {initial[0].group_key}
    assert checkpoint.state.published.keys() == {initial[0].group_key}


def test_minute_support_is_bounded_without_losing_the_episode_anchor_window() -> None:
    # Only the oldest minute lies beyond the detector's baseline reach-back.
    values = {_at(0): 100.0, _at(1): -0.0, _at(70): None, _at(1569): 1 / 3}
    _, checkpoint = advance_org(
        rows=[
            SeriesRow(ts, Signal.REQUESTS, Metric.COUNT, PROJECT, ENV, "", value)
            for ts, value in values.items()
        ]
        + [SeriesRow(_at(0), Signal.REQUESTS, Metric.COUNT, PROJECT, "staging", "", 100.0)],
        hourly_rows=(),
        start=START,
        end=_at(1570),
        footprints=Footprints(),
        projects=(PROJECT,),
    )
    restored = _round_trip(checkpoint)
    # Minutes absent inside the retained span restore as known-missing.
    assert restored.series == {
        SeriesKey(PROJECT, ENV, Signal.REQUESTS, Metric.COUNT): {
            **{_at(i): None for i in range(1, 1570)},
            _at(1): -0.0,
            _at(1569): 1 / 3,
        },
        SeriesKey(PROJECT, "staging", Signal.REQUESTS, Metric.COUNT): {},
    }
    restored_zero = restored.series[SeriesKey(PROJECT, ENV, Signal.REQUESTS, Metric.COUNT)][_at(1)]
    assert restored_zero is not None and copysign(1, restored_zero) == -1


def test_series_and_count_windows_round_trip_at_full_history_depth() -> None:
    evaluator = OrgEvaluator(Footprints(), projects=(PROJECT,))
    cursor = evaluator.state.next_minute = _at(1569)
    floor = history_floor(evaluator, cursor)
    minutes = [
        floor + timedelta(minutes=i) for i in range((cursor - floor) // timedelta(minutes=1))
    ]
    rng = Random(2)
    # All span metrics and companions for a full top-slice cohort, with values that
    # don't compress well.
    series = evaluator.series
    for signal in SPAN_SLICES:
        for dim in range(MAX_SLICES):
            for metric in signal.metrics:
                key = SeriesKey(PROJECT, ENV, signal.name, metric, f"slice-{dim}")
                series[key] = {minute: rng.random() for minute in minutes}
    evaluator.series_history.refresh()
    rolling_length = max(evaluator.series_history.cfg.windows) + DISPERSION_MIN + 1
    failure_keys = [
        key for key in evaluator.series_history.state.watched if key.metric == Metric.FAILURE_RATE
    ]
    assert failure_keys
    for key in failure_keys:
        state = evaluator.series_history.state.series_states[key]
        state.failure_reference = (2.0, 400.0)
        state.counts = deque(
            (
                CountTotals(minute, i, i / 2, 20 * i, 0, i, 24 * i, 0.05)
                for i, minute in enumerate(minutes[-rolling_length:])
            ),
            maxlen=rolling_length,
        )

    restored = _round_trip(snapshot(evaluator, cursor))
    assert restored.series == series
    assert restored.state.series_history == evaluator.series_history.state
    restored_counts = restored.state.series_history.series_states[failure_keys[0]].counts
    assert restored_counts is not None and restored_counts.maxlen == rolling_length


def test_rotating_full_slice_cohorts_bound_checkpoint_state() -> None:
    checkpoint = None
    for batch in range(5):
        _, checkpoint = advance_org(
            rows=[
                SeriesRow(
                    _at(batch),
                    Signal.ENDPOINTS,
                    metric,
                    PROJECT,
                    f"env-{env}",
                    f"/route/{batch}/{dim}",
                    value,
                )
                for env in range(MAX_ENVIRONMENTS)
                for dim in range(MAX_SLICES)
                for metric, value in ((Metric.COUNT_SAMPLE, 500.0), (Metric.FAILURE_RATE, 0.02))
            ],
            hourly_rows=(),
            start=_at(batch),
            end=_at(batch + 1),
            footprints=Footprints(),
            projects=(PROJECT,),
            checkpoint=checkpoint,
        )
        checkpoint = _round_trip(checkpoint)
    assert checkpoint is not None

    def failure_keys(batches: Sequence[int]) -> set[SeriesKey]:
        return {
            SeriesKey(
                PROJECT, f"env-{env}", Signal.ENDPOINTS, Metric.FAILURE_RATE, f"/route/{b}/{dim}"
            )
            for env in range(MAX_ENVIRONMENTS)
            for dim in range(MAX_SLICES)
            for b in batches
        }

    expected_keys = failure_keys((3, 4))
    history = checkpoint.state.series_history
    assert history.watched.keys() == history.series_states.keys() == expected_keys
    assert checkpoint.series.keys() == expected_keys | {
        replace(key, metric=Metric.COUNT_SAMPLE) for key in expected_keys
    }
    assert all(state.counts for state in history.series_states.values())
    assert checkpoint.state.novelty.coverage.keys() == failure_keys((1, 2, 3, 4))


def test_live_slice_and_samples_survive_two_full_rotations() -> None:
    (opened,), checkpoint = advance_org(
        rows=_endpoint_rows(0, 155),
        hourly_rows=(),
        start=START,
        end=_at(155),
        footprints=Footprints(),
        projects=(PROJECT,),
    )
    assert not opened.is_resolved

    for minute, cohort in ((155, "B"), (156, "C")):
        decisions, checkpoint = advance_org(
            rows=[
                SeriesRow(
                    _at(minute),
                    Signal.ENDPOINTS,
                    metric,
                    PROJECT,
                    f"env-{env}",
                    f"/{cohort}/{dim}",
                    value,
                )
                for env in range(MAX_ENVIRONMENTS)
                for dim in range(MAX_SLICES)
                for metric, value in ((Metric.COUNT_SAMPLE, 100.0), (Metric.P95_DURATION, 100.0))
            ],
            hourly_rows=(),
            start=_at(minute),
            end=_at(minute + 1),
            footprints=Footprints(),
            projects=(PROJECT,),
            checkpoint=_round_trip(checkpoint),
        )
        assert not decisions

    checkpoint = _round_trip(checkpoint)
    state = checkpoint.state.series_history.series_states[LATENCY]
    assert state.open is checkpoint.state.correlation.open_groups[opened.group_key].root
    assert state.open is not None and state.open.ended_at is None
    assert checkpoint.series[samples_key(LATENCY)][_at(154)] == 100.0
    assert len(checkpoint.series) == 2 * (2 * MAX_ENVIRONMENTS * MAX_SLICES)

    (closed,), _ = advance_org(
        rows=_endpoint_rows(157, 200),
        hourly_rows=(),
        start=_at(157),
        end=_at(200),
        footprints=Footprints(),
        projects=(PROJECT,),
        checkpoint=checkpoint,
    )
    assert closed == replace(opened, timestamp=closed.timestamp, is_resolved=True)


def test_over_capacity_active_slices_expire_deterministically() -> None:
    evaluator = OrgEvaluator(Footprints(), projects=(PROJECT,))
    cap = 2 * MAX_ENVIRONMENTS * MAX_SLICES
    keys = [replace(LATENCY, dim_value=f"/route/{i:03}") for i in range(cap + 1)]
    # Reverse encounter order, and give the otherwise first tie loser a newer observation.
    for key in reversed(keys):
        evaluator.series[key] = {START: 400.0}
        evaluator.series[samples_key(key)] = {START: 100.0}
    evaluator.series[keys[0]] = {_at(1): 400.0}
    evaluator.series[samples_key(keys[0])] = {_at(1): 100.0}
    evaluator.series_history.refresh()
    series_states = evaluator.series_history.state.series_states
    for key in keys:
        series_states[key].open = ChangeEvent(key, ChangeType.SLOWDOWN, START, 400.0, 100.0, 0.9)
    dropped = keys[1]
    event = series_states[dropped].open
    with patch("sentry.anomaly_detection.checkpoint.retention.metrics.incr") as incr:
        assert not evict_stale_series(evaluator, _at(2), _at(1))
    incr.assert_called_once_with("anomaly_detection.active_episode_evicted", amount=1)

    kept = set(keys) - {dropped}
    assert series_states.keys() == kept
    assert evaluator.series.keys() == kept | {samples_key(key) for key in kept}
    assert event is not None and event.ended_at == _at(1)
    assert event.evidence == ["expired: active episode exceeded checkpoint cohort budget"]


def test_stale_slice_evicts_watch_state_but_keeps_aggregate_presence() -> None:
    stale = SeriesKey(PROJECT, ENV, Signal.ENDPOINTS, Metric.FAILURE_RATE, "/retired")
    current = replace(stale, dim_value=ENDPOINT)
    total = SeriesKey(PROJECT, ENV, Signal.REQUESTS, Metric.COUNT)
    _, checkpoint = advance_org(
        rows=[
            SeriesRow(START, stale.signal, stale.metric, PROJECT, ENV, stale.dim_value, 0.1),
            SeriesRow(
                START, stale.signal, Metric.COUNT_SAMPLE, PROJECT, ENV, stale.dim_value, 100.0
            ),
            SeriesRow(START, total.signal, total.metric, PROJECT, ENV, "", 100.0),
        ],
        hourly_rows=(),
        start=START,
        end=_at(1),
        footprints=Footprints(),
        projects=(PROJECT,),
    )
    checkpoint = _round_trip(checkpoint)
    assert checkpoint.state.series_history.series_states[stale].counts
    checkpoint.state.series_history.exclude[stale] = "unreliable metrics"
    _, checkpoint = advance_org(
        rows=[
            SeriesRow(
                _at(1569), current.signal, current.metric, PROJECT, ENV, current.dim_value, None
            )
        ],
        hourly_rows=(),
        start=_at(1),
        end=_at(1570),
        footprints=Footprints(),
        projects=(PROJECT,),
        checkpoint=checkpoint,
    )
    restored = _round_trip(checkpoint)
    assert restored.series == {total: {}, current: {_at(1569): None}}
    history = restored.state.series_history
    assert history.watched.keys() == history.series_states.keys() == {total, current}
    assert stale not in history.exclude
    # Retiring minute data does not lose recent novelty exposure.
    assert restored.state.novelty.coverage[stale][START] == 1


def _unobserved_open_slice() -> tuple[AnomalyDecision, Checkpoint]:
    """An open, published slowdown whose measurements then stop arriving."""
    event = ChangeEvent(
        LATENCY, ChangeType.SLOWDOWN, START, 400.0, 100.0, 0.9, open_ratio=4.0, sustained_at=_at(30)
    )
    evaluator = OrgEvaluator(Footprints(), projects=(PROJECT,))
    evaluator.series[LATENCY] = {START: event.actual}
    evaluator.series_history.refresh()
    evaluator.series_history.state.series_states[LATENCY].open = event
    evaluator.decision_log.record(evaluator.corr.step(START, [("open", event)]))
    (opened,) = evaluator.decision_log.record(evaluator.corr.step(_at(30), []))
    evaluator.state.next_minute = _at(31)

    decisions, checkpoint = advance_org(
        rows=(),
        hourly_rows=(),
        start=_at(31),
        end=_at(1569),
        footprints=Footprints(),
        projects=(PROJECT,),
        checkpoint=_round_trip(snapshot(evaluator, _at(31))),
    )
    assert not decisions
    assert LATENCY in checkpoint.state.series_history.series_states
    return opened, _round_trip(checkpoint)


def _assert_expires_then_closes_quietly(opened: AnomalyDecision, checkpoint: Checkpoint) -> None:
    expired = checkpoint.state.correlation.open_groups[opened.group_key].root
    assert expired.ended_at == _at(1569)
    assert expired.evidence == ["expired: measurements no longer collected"]

    decisions, _ = advance_org(
        rows=(),
        hourly_rows=(),
        start=_at(1570),
        end=_at(1585),
        footprints=Footprints(),
        projects=(PROJECT,),
        checkpoint=checkpoint,
    )
    assert list(decisions) == [replace(opened, timestamp=_at(1584), is_resolved=True)]


def test_uncollected_open_slice_expires_without_claiming_recovery() -> None:
    opened, checkpoint = _unobserved_open_slice()

    decisions, checkpoint = advance_org(
        rows=(),
        hourly_rows=(),
        start=_at(1569),
        end=_at(1570),
        footprints=Footprints(),
        projects=(PROJECT,),
        checkpoint=checkpoint,
    )
    assert not decisions  # The correlator still observes its normal quiet window.
    checkpoint = _round_trip(checkpoint)
    assert LATENCY not in checkpoint.state.series_history.series_states
    _assert_expires_then_closes_quietly(opened, checkpoint)


def test_unmeasured_open_slice_expires_without_claiming_recovery() -> None:
    opened, checkpoint = _unobserved_open_slice()

    decisions, checkpoint = advance_org(
        rows=[SeriesRow(_at(1569), LATENCY.signal, LATENCY.metric, PROJECT, ENV, ENDPOINT, None)],
        hourly_rows=(),
        start=_at(1569),
        end=_at(1570),
        footprints=Footprints(),
        projects=(PROJECT,),
        checkpoint=checkpoint,
    )
    assert not decisions  # The correlator still observes its normal quiet window.
    checkpoint = _round_trip(checkpoint)
    assert checkpoint.state.series_history.series_states[LATENCY].open is None
    _assert_expires_then_closes_quietly(opened, checkpoint)


def test_checkpoint_prunes_old_group_members_without_losing_live_aliases() -> None:
    evaluator = OrgEvaluator(Footprints(), projects=(PROJECT,))
    root = ChangeEvent(LATENCY, ChangeType.SLOWDOWN, START, 400.0, 100.0, 0.9, ended_at=_at(5))
    evaluator.corr.step(START, [("open", root)])
    (group,) = evaluator.corr.groups
    group.members[episode_key(root)].closed_at = _at(5)

    alias_key = replace(LATENCY, dim_value="/alias")
    old = root.replace(key=replace(alias_key, project_id=43), start=_at(1), issue_ids=(123,))
    live = root.replace(key=alias_key, start=_at(400), ended_at=None)
    recent = root.replace(key=alias_key, start=_at(390), ended_at=_at(395), issue_ids=(456,))
    group.members[episode_key(old)] = MemberState(old, 4.0, closed_at=old.ended_at)
    group.members[episode_key(live)] = MemberState(live, 4.0, representative=episode_key(old))
    group.members[episode_key(recent)] = MemberState(
        recent, 4.0, closed_at=recent.ended_at, representative=episode_key(old)
    )
    group.localization = f"{PROJECT}/{ENV} endpoint {ENDPOINT} (shared with 43/{ENV})"
    evaluator.state.next_minute = _at(410)

    restored = OrgEvaluator(
        Footprints(), projects=(PROJECT,), checkpoint=_round_trip(snapshot(evaluator, _at(410)))
    )
    (continued,) = restored.corr.groups
    assert continued.root == root
    assert continued.change_events == [root, live, recent]
    assert continued.blast_radius == [Service(PROJECT, ENV)]
    assert continued.driving_issues == [456]
    assert continued.localization == f"{PROJECT}/{ENV} endpoint {ENDPOINT}"
    assert set(restored.corr.by_event) == {
        episode_key(root),
        episode_key(live),
        episode_key(recent),
    }
    assert restored.corr.independent(continued) == 2
    assert continued.members[episode_key(live)].representative == episode_key(recent)


def test_novelty_retains_recent_excursions_but_ages_out_old_ones() -> None:
    _, checkpoint = advance_org(
        rows=_endpoint_rows(0, 200),
        hourly_rows=(),
        start=START,
        end=_at(200),
        footprints=Footprints(),
        projects=(PROJECT,),
    )
    checkpoint = _round_trip(checkpoint)
    assert checkpoint.state.novelty.history
    assert checkpoint.state.novelty.coverage
    _, checkpoint = advance_org(
        rows=(),
        hourly_rows=(),
        start=_at(200),
        end=_at(200) + timedelta(days=15),
        footprints=Footprints(),
        projects=(PROJECT,),
        checkpoint=checkpoint,
    )
    assert not checkpoint.state.novelty.history
    assert not checkpoint.state.novelty.coverage


@pytest.mark.parametrize(("published_owner", "emit_close"), ((PROJECT, True), (43, False)))
def test_project_scope_change_retires_mixed_group_without_rebinding(
    published_owner: int, emit_close: bool
) -> None:
    disabled = 43
    retained_key = LATENCY
    removed_key = replace(LATENCY, project_id=disabled)
    retained = ChangeEvent(
        retained_key,
        ChangeType.SLOWDOWN,
        START,
        400.0,
        100.0,
        0.9,
        open_ratio=4.0,
        sustained_at=_at(30),
    )
    removed = ChangeEvent(
        removed_key, ChangeType.SLOWDOWN, _at(1), 400.0, 100.0, 0.9, detected_at=_at(31)
    )
    evaluator = OrgEvaluator(Footprints(), projects=(PROJECT, disabled))
    for event in (retained, removed):
        evaluator.series[event.key] = {event.start: event.actual}
        evaluator.novelty.observe(event.key, event.start)
        evaluator.novelty.record(event)
    evaluator.series_history.refresh()
    for event in (retained, removed):
        evaluator.series_history.state.series_states[event.key].open = event

    record = evaluator.decision_log.record
    record(evaluator.corr.step(START, [("open", retained)]))
    (opened,) = record(evaluator.corr.step(_at(30), []))
    record(evaluator.corr.step(_at(31), [("open", removed)]))
    mixed = evaluator.corr.state.open_groups[opened.group_key]
    assert opened.project_id == PROJECT
    assert mixed.change_events == [retained, removed]
    assert evaluator.corr.state.edges
    # Even when correlation's current root has changed, the published owner is
    # pinned to the decision. Simulate both owners to cover both close paths.
    mixed.root = removed
    opened = replace(opened, project_id=published_owner, env="published-env")
    evaluator.state.published[opened.group_key] = opened

    # Persist additional disabled-project state beyond the group's events.
    cp_key = SeriesKey(disabled, ENV, Signal.ERROR_RATE, Metric.ERRORS_PER_REQUEST)
    evaluator.series[cp_key] = {_at(30): 0.01}
    evaluator.rate_shifts.refresh()
    evaluator.rate_shifts.state[cp_key].hits = 2
    a = DependencySlice(Service(PROJECT, ENV), Signal.OUTBOUND_HTTP, "example.com")
    b = DependencySlice(Service(disabled, ENV), Signal.OUTBOUND_HTTP, "example.com")
    evaluator.corr.shared.pairs[frozenset((a, b))] = PairStats(a, b, 5, 0.1)
    pending = ChangeEvent(
        SeriesKey(disabled, ENV, Signal.NEW_ISSUE, Metric.COUNT_UNIQUE_USER, "123"),
        ChangeType.NEW_FAILURE_MODE,
        _at(32),
        10.0,
        10.0,
        0.9,
    )
    evaluator.state.pending_issues.append(pending)
    evaluator.state.next_minute = _at(32)

    decisions, checkpoint = advance_org(
        rows=[SeriesRow(_at(32), Signal.REQUESTS, Metric.COUNT, disabled, ENV, "", 100.0)],
        hourly_rows=(),
        start=_at(32),
        end=_at(33),
        footprints=Footprints(),
        projects=(PROJECT,),
        new_issues=[pending],
        checkpoint=_round_trip(snapshot(evaluator, _at(32))),
    )
    assert len(decisions) == int(emit_close)
    assert all(
        decision == replace(opened, timestamp=_at(32), is_resolved=True) for decision in decisions
    )
    restored = _round_trip(checkpoint).state
    assert not restored.published
    assert set(checkpoint.series) == {retained_key}
    assert set(restored.series_history.series_states) == {retained_key}
    assert set(restored.novelty.coverage) == set(restored.novelty.history) == {retained_key}
    assert not restored.rate_shifts
    assert not restored.pending_issues
    assert not restored.known_issues
    assert not restored.correlation.open_groups
    assert not restored.correlation.closed_groups
    assert not restored.correlation.edges
    assert not restored.correlation.edge_seen_at
    assert not restored.correlation.shared.pairs
    candidate = restored.correlation.latent[episode_key(retained)]
    assert candidate is restored.series_history.series_states[retained_key].open


def _checkpoint_with_pending_issue(novelty: NoveltyEvidence | None = None) -> Checkpoint:
    evaluator = OrgEvaluator(Footprints(), projects=(PROJECT,))
    evaluator.series[LATENCY] = {_at(-1): 100.0}
    evaluator.series_history.refresh()
    evaluator.state.pending_issues.append(
        ChangeEvent(
            SeriesKey(PROJECT, ENV, Signal.NEW_ISSUE, Metric.COUNT_UNIQUE_USER, "123"),
            ChangeType.NEW_FAILURE_MODE,
            _at(-1),
            10.0,
            10.0,
            0.9,
            novelty=novelty,
        )
    )
    evaluator.state.next_minute = START
    return snapshot(evaluator, START)


def test_unreadable_or_other_version_checkpoint_decodes_to_none() -> None:
    blob = codec.encode(_checkpoint_with_pending_issue())
    assert codec.decode(blob) is not None

    with patch.object(codec, "CHECKPOINT_VERSION", codec.CHECKPOINT_VERSION + 1):
        assert codec.decode(blob) is None
    assert codec.decode(b"") is None
    assert codec.decode(b"not a checkpoint") is None
    assert codec.decode(blob[:-8]) is None
    assert codec.decode(zlib.compress(b"\x93\x01\x02\x03")) is None


def test_non_finite_novelty_survives_round_trip() -> None:
    novelty = NoveltyEvidence(return_days=inf, size=-inf, history_days=14.0)
    checkpoint = _round_trip(_checkpoint_with_pending_issue(novelty))
    (restored,) = checkpoint.state.pending_issues
    assert restored.novelty == novelty


def test_empty_advance_with_narrower_scope_keeps_other_projects_hourly_support() -> None:
    keys = [replace(LATENCY, project_id=project) for project in (PROJECT, 43)]
    hours = [START - timedelta(days=day) for day in range(1, 8)]
    evaluator = OrgEvaluator(Footprints(), projects=(PROJECT, 43))
    for key in keys:
        evaluator.series[key] = {_at(-1): 400.0}
        evaluator.hourly[key] = dict.fromkeys(hours, 100.0)
    evaluator.series_history.refresh()
    for key in keys:
        state = evaluator.series_history.state.series_states[key]
        state.open = ChangeEvent(key, ChangeType.SLOWDOWN, _at(-1), 400.0, 100.0, 0.9)
        state.anchor_level = 100.0
    evaluator.state.next_minute = START

    # An empty range snapshots without reconciling scope; it must not silently
    # drop the seasonal support of open anchored episodes it still retains.
    decisions, checkpoint = advance_org(
        rows=(),
        hourly_rows=(),
        start=START,
        end=START,
        footprints=Footprints(),
        projects=(PROJECT,),
        checkpoint=_round_trip(snapshot(evaluator, START)),
    )
    assert not decisions
    restored = _round_trip(checkpoint)
    assert set(restored.state.series_history.series_states) == set(keys)
    assert restored.hourly == {key: dict.fromkeys(hours, 100.0) for key in keys}


def _measurement(key_index: int, minute_index: int, scale: float) -> float:
    # Deterministic and non-repeating, so values don't compress to a pattern.
    return scale * (1 + ((key_index * 104_729 + minute_index * 7_919) % 1_009) / 10_090)


@cell_silo_test
class TestDenseWorkerCheckpoint(TestCase):
    def test_writes_and_restores_dense_checkpoint_at_project_limit(self) -> None:
        projects = [
            self.create_project(organization=self.organization)
            for _ in range(options.get("anomaly_detection.max_projects_per_organization"))
        ]
        for project in projects:
            self.create_detector(project=project, type=DetectorType.ANOMALY_DETECTION, enabled=True)
        project_ids = {project.id for project in projects}
        scale = {
            Metric.COUNT: 1000.0,
            Metric.COUNT_SAMPLE: 100.0,
            Metric.P95_DURATION: 100.0,
            Metric.FAILURE_RATE: 0.1,
        }
        series = [
            SeriesKey(project, f"env-{env}", signal.name, metric, f"slice-{dim}")
            for project in sorted(project_ids)
            for env in range(MAX_ENVIRONMENTS)
            for signal in SPAN_SLICES
            for dim in range(MAX_SLICES)
            for metric in signal.metrics
        ]
        # A full, non-repeating slice cohort at all project slots, shorter than warmup.
        warm_minutes = 128
        first_end = _at(warm_minutes)
        second_end = _at(warm_minutes + 1)

        def collect(
            organization: Organization,
            scoped_projects: Sequence[Project],
            start: datetime,
            end: datetime,
            interval: str,
        ) -> list[SeriesRow]:
            assert organization == self.organization
            assert {project.id for project in scoped_projects} == project_ids
            assert interval == "1m"
            first = max(start, START)
            return [
                SeriesRow(
                    minute,
                    key.signal,
                    key.metric,
                    key.project_id,
                    key.env,
                    key.dim_value,
                    _measurement(
                        index, (minute - START) // timedelta(minutes=1), scale[key.metric]
                    ),
                )
                for offset in range((end - first) // timedelta(minutes=1))
                for minute in [first + timedelta(minutes=offset)]
                for index, key in enumerate(series)
            ]

        with (
            self.feature(schedule.FEATURE),
            patch.object(schedule, "collect", side_effect=collect),
            patch.object(schedule, "hourly_rows", return_value=[]),
            patch.object(schedule, "collect_new_failure_modes", return_value=[]),
            patch.object(TraceLookup, "footprint", return_value=None),
        ):
            assert not schedule._run_organization(self.organization.id, first_end)
            state = AnomalyDetectionState.objects.get(organization=self.organization)
            assert state.next_minute == first_end.replace(tzinfo=UTC)
            assert codec.decode(bytes(state.checkpoint)) is not None

            assert not schedule._run_organization(self.organization.id, second_end)
            state.refresh_from_db()
            assert state.next_minute == second_end.replace(tzinfo=UTC)

        restored = codec.decode(bytes(state.checkpoint))
        assert restored is not None
        assert restored.state.next_minute == second_end
        assert restored.series.keys() == set(series)
        assert all(len(points) == warm_minutes + 1 for points in restored.series.values())
        for index, key in [(0, series[0]), (len(series) - 1, series[-1])]:
            assert restored.series[key] == {
                _at(minute): _measurement(index, minute, scale[key.metric])
                for minute in range(warm_minutes + 1)
            }
