import json  # noqa: S003 -- sentry.utils.json can't reject NaN/Infinity like Postgres jsonb
from base64 import b64decode
from collections import Counter, deque
from collections.abc import Sequence
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from math import copysign, inf
from random import Random
from typing import Any
from unittest.mock import patch

import orjson
import pytest

from sentry import options
from sentry.anomaly_detection import schedule
from sentry.anomaly_detection.checkpoint.codec import (
    CHECKPOINT_VERSION,
    _restore,
    _snapshot,
    is_current,
)
from sentry.anomaly_detection.checkpoint.replay import advance_org
from sentry.anomaly_detection.checkpoint.retention import _evict_stale_series, _history_floor
from sentry.anomaly_detection.contracts import (
    ChangeEvent,
    ChangeType,
    Metric,
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
from sentry.anomaly_detection.evaluation.organization import AnomalyDecision, OrgEvaluator
from sentry.anomaly_detection.evaluation.series import samples_key
from sentry.anomaly_detection.grouptype import AnomalyDetection
from sentry.anomaly_detection.inputs.measurements import MAX_ENVIRONMENTS, MAX_SLICES, SPAN_SLICES
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


class Footprints:
    def footprint(self, event: ChangeEvent, observation_end: datetime) -> Footprint:
        return Footprint(
            event=event.key,
            traces=["trace-1"],
            slices={
                Slice(Service(PROJECT, ENV), Signal.ENDPOINTS, ENDPOINT): SliceStats(
                    0.5, 400.0, 100
                )
            },
            edges=Counter(
                {CallEdge(Service(42, "production"), "example.com", Service(43, "production")): 1}
            ),
            window=(event.start, min(observation_end, event.start + timedelta(minutes=5))),
        )


def _at(minute: int) -> datetime:
    return START + timedelta(minutes=minute)


def _round_trip(checkpoint: dict[str, Any]) -> dict[str, Any]:
    # Postgres jsonb rejects non-finite numbers; never write them as null.
    return json.loads(json.dumps(checkpoint, sort_keys=True, allow_nan=False))


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


def test_split_slowdown_matches_continuous_activation_and_resolution() -> None:
    hourly: list[SeriesRow] = [
        SeriesRow(ts, Signal.ENDPOINTS, metric, PROJECT, ENV, ENDPOINT, value)
        for hour in range(12, 16)
        for day in range(1, 15)
        for ts in [START.replace(hour=hour) - timedelta(days=day)]
        for metric, value in ((Metric.COUNT_SAMPLE, 6000.0), (Metric.P95_DURATION, 100.0))
    ]
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

    checkpoint: dict[str, Any] | None = None
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
    # Detector/group/novelty must all have observed mutations on one live event;
    # resnapshotting it after recovery must not create stale parallel copies.
    (event,) = checkpoint["events"]
    assert event["change_type"] == ChangeType.SLOWDOWN
    assert event["sustained_at"] is not None
    assert event["ended_at"] is not None
    assert {d["group_key"] for d in checkpoint["qualified"]} == {opened.group_key}


@pytest.mark.parametrize("fresh_shape", (None, 1000.0))
def test_restored_slowdown_uses_seasonal_history_when_hourly_top_slices_change(
    fresh_shape: float | None,
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
    recovery_rows = _endpoint_rows(180, 230, normal=fresh_shape or 250.0)
    fresh = [
        SeriesRow(ts, signal, metric, project, env, "/other", value)
        for ts, signal, metric, project, env, _, value in hourly
    ]
    if fresh_shape is not None:
        # Fresh measurements at the same timestamps must override carried support.
        fresh += [
            SeriesRow(
                ts,
                signal,
                metric,
                project,
                env,
                dim,
                fresh_shape if metric == Metric.P95_DURATION else value,
            )
            for ts, signal, metric, project, env, dim, value in hourly
            if ts.hour == 15
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
    key = SeriesKey(PROJECT, ENV, Signal.ENDPOINTS, Metric.P95_DURATION, ENDPOINT)
    restored = _restore(Footprints(), checkpoint, projects=(PROJECT,))
    assert restored.hourly == {
        key: {
            ts: value
            for ts, _, metric, _, _, _, value in hourly
            if metric == key.metric and ts.date() >= (START - timedelta(days=14)).date()
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
    assert not checkpoint["hourly_support"]


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
    closed, checkpoint = advance_org(
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
    (event,) = checkpoint["events"]
    assert event["change_type"] == ChangeType.CHANGE_POINT
    assert event["ended_at"] is not None


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
    (pending_index,) = checkpoint["pending_issues"]
    assert checkpoint["events"][pending_index]["issue_ids"] == [123]
    (restored_pending,) = _restore(
        Footprints(), _round_trip(checkpoint), projects=(PROJECT,)
    ).pending_issues
    assert restored_pending.issue_ids == (123,)
    continued, checkpoint = advance_org(
        rows=(),
        hourly_rows=(),
        start=_at(46),
        end=_at(94),
        footprints=Footprints(),
        projects=(PROJECT,),
        checkpoint=_round_trip(checkpoint),
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
    assert {d["group_key"] for d in checkpoint["qualified"]} == {initial[0].group_key}


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
    restored = _restore(Footprints(), _round_trip(checkpoint), projects=(PROJECT,))
    assert restored.series == {
        SeriesKey(PROJECT, ENV, Signal.REQUESTS, Metric.COUNT): {
            ts: value for ts, value in values.items() if ts != START
        },
        SeriesKey(PROJECT, "staging", Signal.REQUESTS, Metric.COUNT): {},
    }
    restored_zero = restored.series[SeriesKey(PROJECT, ENV, Signal.REQUESTS, Metric.COUNT)][_at(1)]
    assert restored_zero is not None and copysign(1, restored_zero) == -1


def test_dense_collector_checkpoint_round_trips_at_full_history_depth() -> None:
    evaluator = OrgEvaluator(Footprints(), projects=(PROJECT,))
    cursor = evaluator.next_minute = _at(1569)
    floor = _history_floor(evaluator, cursor)
    minutes = [_at(i) for i in range((cursor - floor) // timedelta(minutes=1))]
    rng = Random(2)
    # All span metrics/companions for the full top-slice cohort, across five
    # projects and two environments. Vary the values so the test does not rely
    # on measurements compressing well. The old 8 MiB limit could not fit this.
    series = evaluator.series
    for project in range(5):
        for env in (ENV, "staging"):
            for signal in SPAN_SLICES:
                for dim in range(MAX_SLICES):
                    for metric in signal.metrics:
                        key = SeriesKey(project, env, signal.name, metric, f"slice-{dim}")
                        series[key] = {minute: rng.random() for minute in minutes}
    evaluator.series_history.refresh()
    rolling_length = max(evaluator.series_history.cfg.windows) + DISPERSION_MIN + 1
    for key in evaluator.series_history.watched:
        if key.metric != "failure_rate()":
            continue
        state = evaluator.series_history.state[key]
        state.failure_reference = (2.0, 400.0)
        state.counts = deque(
            (
                CountTotals(minute, i, i / 2, 20 * i, 0, i, 24 * i, 0.05)
                for i, minute in enumerate(minutes[-rolling_length:])
            ),
            maxlen=rolling_length,
        )

    checkpoint = _snapshot(evaluator, cursor)
    raw_uncompressed_size = sum(len(points) * 8 for points in series.values())
    assert raw_uncompressed_size > 8 * 1024 * 1024
    # Each dense chunk stays within its lossless raw budget, regardless of entropy.
    assert all(
        dense and len(b64decode(payload)) <= len(minutes) * 8
        for _, (_, dense, _, payload) in checkpoint["series"]
    )
    restored = _restore(Footprints(), _round_trip(checkpoint), projects=(PROJECT,))
    assert restored.series == series
    assert restored.series_history.state == evaluator.series_history.state


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
            checkpoint=None if checkpoint is None else _round_trip(checkpoint),
        )
    assert checkpoint is not None
    restored = _restore(Footprints(), _round_trip(checkpoint), projects=(PROJECT,))
    expected_keys = {
        SeriesKey(
            PROJECT, f"env-{env}", Signal.ENDPOINTS, Metric.FAILURE_RATE, f"/route/{batch}/{dim}"
        )
        for env in range(MAX_ENVIRONMENTS)
        for dim in range(MAX_SLICES)
        for batch in (3, 4)
    }
    assert (
        restored.series_history.watched.keys()
        == restored.series_history.state.keys()
        == expected_keys
    )
    assert restored.series.keys() == expected_keys | {
        replace(key, metric=Metric.COUNT_SAMPLE) for key in expected_keys
    }
    assert all(state.counts for state in restored.series_history.state.values())
    assert restored.novelty.coverage.keys() == {
        SeriesKey(
            PROJECT, f"env-{env}", Signal.ENDPOINTS, Metric.FAILURE_RATE, f"/route/{batch}/{dim}"
        )
        for env in range(MAX_ENVIRONMENTS)
        for dim in range(MAX_SLICES)
        for batch in (1, 2, 3, 4)
    }


def test_live_slice_and_samples_survive_two_full_rotations() -> None:
    projects = (PROJECT,)
    (opened,), checkpoint = advance_org(
        rows=_endpoint_rows(0, 155),
        hourly_rows=(),
        start=START,
        end=_at(155),
        footprints=Footprints(),
        projects=projects,
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
            projects=projects,
            checkpoint=_round_trip(checkpoint),
        )
        assert not decisions

    restored = _restore(Footprints(), _round_trip(checkpoint), projects=projects)
    key = SeriesKey(PROJECT, ENV, Signal.ENDPOINTS, Metric.P95_DURATION, ENDPOINT)
    state = restored.series_history.state[key]
    assert state.open is restored.corr.state.open_groups[opened.group_key].root
    assert state.open is not None and state.open.ended_at is None
    assert restored.series[samples_key(key)][_at(154)] == 100.0
    assert len(restored.series) == 2 * (2 * MAX_ENVIRONMENTS * MAX_SLICES)

    (closed,), checkpoint = advance_org(
        rows=_endpoint_rows(157, 200),
        hourly_rows=(),
        start=_at(157),
        end=_at(200),
        footprints=Footprints(),
        projects=projects,
        checkpoint=_round_trip(checkpoint),
    )
    assert closed == replace(opened, timestamp=closed.timestamp, is_resolved=True)
    (event,) = checkpoint["events"]
    assert "recovered" in event["evidence"]


def test_over_capacity_active_slices_expire_deterministically() -> None:
    evaluator = OrgEvaluator(Footprints(), projects=(PROJECT,))
    cap = 2 * MAX_ENVIRONMENTS * MAX_SLICES
    keys = [
        SeriesKey(PROJECT, ENV, Signal.ENDPOINTS, Metric.P95_DURATION, f"/route/{i:03}")
        for i in range(cap + 1)
    ]
    # Reverse encounter order, and give the otherwise first tie loser a newer observation.
    for key in reversed(keys):
        minute = _at(1) if key == keys[0] else START
        evaluator.series[key] = {minute: 400.0}
        evaluator.series[samples_key(key)] = {minute: 100.0}
    evaluator.series_history.refresh()
    for key in keys:
        evaluator.series_history.state[key].open = ChangeEvent(
            key, ChangeType.SLOWDOWN, START, 400.0, 100.0, 0.9
        )
    dropped = keys[1]
    event = evaluator.series_history.state[dropped].open
    with patch("sentry.anomaly_detection.checkpoint.retention.metrics.incr") as incr:
        assert not _evict_stale_series(evaluator, _at(2), _at(1))
    incr.assert_called_once_with("anomaly_detection.active_episode_evicted", amount=1)

    kept = set(keys) - {dropped}
    assert evaluator.series_history.state.keys() == kept
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
    before = _restore(Footprints(), checkpoint, projects=(PROJECT,))
    assert before.series_history.state[stale].counts
    before.series_history.exclude = {stale: "unreliable metrics"}
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
        checkpoint=_round_trip(_snapshot(before, _at(1))),
    )
    restored = _restore(Footprints(), _round_trip(checkpoint), projects=(PROJECT,))
    assert restored.series == {total: {}, current: {_at(1569): None}}
    assert (
        restored.series_history.watched.keys()
        == restored.series_history.state.keys()
        == {total, current}
    )
    assert stale not in restored.series_history.exclude
    # Retiring minute data does not lose recent novelty exposure.
    assert restored.novelty.coverage[stale][START] == 1


@pytest.mark.parametrize("present_but_unmeasured", (False, True))
def test_unobserved_open_slice_expires_without_claiming_recovery(
    present_but_unmeasured: bool,
) -> None:
    key = SeriesKey(PROJECT, ENV, Signal.ENDPOINTS, Metric.P95_DURATION, ENDPOINT)
    event = ChangeEvent(
        key, ChangeType.SLOWDOWN, START, 400.0, 100.0, 0.9, open_ratio=4.0, sustained_at=_at(30)
    )
    evaluator = OrgEvaluator(Footprints(), projects=(PROJECT,))
    evaluator.series[key] = {START: event.actual}
    evaluator.series_history.refresh()
    evaluator.series_history.state[key].open = event
    evaluator._decisions(evaluator.corr.step(START, [("open", event)]))
    (opened,) = evaluator._decisions(evaluator.corr.step(_at(30), []))
    evaluator.next_minute = _at(31)

    decisions, checkpoint = advance_org(
        rows=(),
        hourly_rows=(),
        start=_at(31),
        end=_at(1569),
        footprints=Footprints(),
        projects=(PROJECT,),
        checkpoint=_round_trip(_snapshot(evaluator, _at(31))),
    )
    assert not decisions
    assert key in _restore(Footprints(), checkpoint, projects=(PROJECT,)).series_history.state
    decisions, checkpoint = advance_org(
        rows=(
            [SeriesRow(_at(1569), key.signal, key.metric, PROJECT, ENV, key.dim_value, None)]
            if present_but_unmeasured
            else ()
        ),
        hourly_rows=(),
        start=_at(1569),
        end=_at(1570),
        footprints=Footprints(),
        projects=(PROJECT,),
        checkpoint=_round_trip(checkpoint),
    )
    assert not decisions  # The correlator still observes its normal quiet window.
    restored = _restore(Footprints(), checkpoint, projects=(PROJECT,))
    if present_but_unmeasured:
        assert restored.series_history.state[key].open is None
    else:
        assert key not in restored.series_history.state
    expired = restored.corr.state.open_groups[opened.group_key].root
    assert expired.ended_at == _at(1569)
    assert expired.evidence == ["expired: measurements no longer collected"]

    decisions, _ = advance_org(
        rows=(),
        hourly_rows=(),
        start=_at(1570),
        end=_at(1585),
        footprints=Footprints(),
        projects=(PROJECT,),
        checkpoint=_round_trip(checkpoint),
    )
    assert list(decisions) == [replace(opened, timestamp=_at(1584), is_resolved=True)]


def test_checkpoint_prunes_old_group_members_without_losing_live_aliases() -> None:
    evaluator = OrgEvaluator(Footprints(), projects=(PROJECT,))
    key = SeriesKey(PROJECT, ENV, Signal.ENDPOINTS, Metric.P95_DURATION, ENDPOINT)
    root = ChangeEvent(key, ChangeType.SLOWDOWN, START, 400.0, 100.0, 0.9, ended_at=_at(5))
    evaluator.corr.step(START, [("open", root)])
    (group,) = evaluator.corr.groups
    group.members[episode_key(root)].closed_at = _at(5)

    alias_key = replace(key, dim_value="/alias")
    old = replace(root, key=replace(alias_key, project_id=43), start=_at(1), issue_ids=(123,))
    live = replace(root, key=alias_key, start=_at(400), ended_at=None)
    recent = replace(root, key=alias_key, start=_at(390), ended_at=_at(395), issue_ids=(456,))
    group.members[episode_key(old)] = MemberState(old, 4.0, closed_at=old.ended_at)
    group.members[episode_key(live)] = MemberState(live, 4.0, representative=episode_key(old))
    group.members[episode_key(recent)] = MemberState(
        recent, 4.0, closed_at=recent.ended_at, representative=episode_key(old)
    )
    group.group.change_events.extend((old, live, recent))
    group.group.blast_radius.append(Service(43, ENV))
    group.group.driving_issues[:] = [123, 456]
    group.group.localization = f"{PROJECT}/{ENV} endpoint {ENDPOINT} (shared with 43/{ENV})"
    evaluator.next_minute = _at(410)

    checkpoint = _round_trip(_snapshot(evaluator, _at(410)))
    restored = _restore(Footprints(), checkpoint, projects=(PROJECT,))
    (continued,) = restored.corr.groups
    assert continued.root == root
    assert continued.group.change_events == [root, live, recent]
    assert continued.group.blast_radius == [Service(PROJECT, ENV)]
    assert continued.group.driving_issues == [456]
    assert continued.group.localization == f"{PROJECT}/{ENV} endpoint {ENDPOINT}"
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
    assert checkpoint["novelty"]["history"]
    assert checkpoint["novelty"]["coverage"]
    _, checkpoint = advance_org(
        rows=(),
        hourly_rows=(),
        start=_at(200),
        end=_at(200) + timedelta(days=15),
        footprints=Footprints(),
        projects=(PROJECT,),
        checkpoint=_round_trip(checkpoint),
    )
    assert not checkpoint["novelty"]["history"]
    assert not checkpoint["novelty"]["coverage"]


@pytest.mark.parametrize(("published_owner", "emit_close"), ((PROJECT, True), (43, False)))
def test_project_scope_change_retires_mixed_group_without_rebinding(
    published_owner: int, emit_close: bool
) -> None:
    disabled = 43
    retained_key = SeriesKey(PROJECT, ENV, Signal.ENDPOINTS, Metric.P95_DURATION, ENDPOINT)
    removed_key = SeriesKey(disabled, ENV, Signal.ENDPOINTS, Metric.P95_DURATION, ENDPOINT)
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
        evaluator.series_history.state[event.key].open = event

    evaluator._decisions(evaluator.corr.step(START, [("open", retained)]))
    (opened,) = evaluator._decisions(evaluator.corr.step(_at(30), []))
    evaluator._decisions(evaluator.corr.step(_at(31), [("open", removed)]))
    mixed = evaluator.corr.state.open_groups[opened.group_key]
    assert opened.project_id == PROJECT
    assert mixed.group.change_events == [retained, removed]
    assert evaluator.corr.state.edges
    # Even when correlation's current root has changed, the published owner is
    # pinned to the decision. Simulate both owners to cover both close paths.
    mixed.root = removed
    opened = replace(opened, project_id=published_owner, env="published-env")
    evaluator.qualified[opened.group_key] = opened

    # Persist additional disabled-project state beyond the group's events.
    cp_key = SeriesKey(disabled, ENV, Signal.ERROR_RATE, Metric.ERRORS_PER_REQUEST)
    evaluator.series[cp_key] = {_at(30): 0.01}
    evaluator.rate_shifts.refresh()
    evaluator.rate_shifts.state[cp_key].hits = 2
    a = DependencySlice(Service(PROJECT, ENV), Signal.OUTBOUND_HTTP, "example.com")
    b = DependencySlice(Service(disabled, ENV), Signal.OUTBOUND_HTTP, "example.com")
    evaluator.corr.shared.pairs[frozenset((a, b))] = PairStats(a, b, 5, 5, 5, 0.1, 0.001)
    pending = ChangeEvent(
        SeriesKey(disabled, ENV, Signal.NEW_ISSUE, Metric.COUNT_UNIQUE_USER, "123"),
        ChangeType.NEW_FAILURE_MODE,
        _at(32),
        10.0,
        10.0,
        0.9,
    )
    evaluator.pending_issues.append(pending)
    evaluator.next_minute = _at(32)

    decisions, checkpoint = advance_org(
        rows=[SeriesRow(_at(32), Signal.REQUESTS, Metric.COUNT, disabled, ENV, "", 100.0)],
        hourly_rows=(),
        start=_at(32),
        end=_at(33),
        footprints=Footprints(),
        projects=(PROJECT,),
        new_issues=[pending],
        checkpoint=_round_trip(_snapshot(evaluator, _at(32))),
    )
    assert len(decisions) == int(emit_close)
    assert all(
        decision == replace(opened, timestamp=_at(32), is_resolved=True) for decision in decisions
    )
    assert not {d["group_key"] for d in checkpoint["qualified"]}
    restored = _restore(Footprints(), checkpoint, projects=(PROJECT,))
    assert set(restored.series) == {retained_key}
    assert set(restored.series_history.state) == {retained_key}
    assert set(restored.novelty.coverage) == set(restored.novelty.history) == {retained_key}
    assert not restored.rate_shifts.state
    assert not restored.pending_issues
    assert not restored.known_issues
    assert not restored.corr.groups
    assert not restored.corr.by_event
    assert not restored.corr.state.edges
    assert not restored.corr.state.edge_seen_at
    assert not restored.corr.shared.pairs
    candidate = restored.corr.state.latent[episode_key(retained)]
    assert candidate is restored.series_history.state[retained_key].open
    assert len(checkpoint["events"]) == 1


def _checkpoint_with_pending_issue(novelty: dict[str, Any] | None = None) -> dict[str, Any]:
    evaluator = OrgEvaluator(Footprints(), projects=(PROJECT,))
    evaluator.series[SeriesKey(PROJECT, ENV, Signal.ENDPOINTS, Metric.P95_DURATION, ENDPOINT)] = {
        _at(-1): 100.0
    }
    evaluator.series_history.refresh()
    evaluator.pending_issues.append(
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
    evaluator.next_minute = START
    return _round_trip(_snapshot(evaluator, START))


@pytest.mark.parametrize(
    "version",
    (
        None,
        CHECKPOINT_VERSION - 1,
        CHECKPOINT_VERSION + 1,
        float(CHECKPOINT_VERSION),
        str(CHECKPOINT_VERSION),
        True,
    ),
)
def test_unsupported_checkpoint_version_fails_without_advancing(version: object) -> None:
    current = _checkpoint_with_pending_issue()
    assert is_current(current)
    _restore(Footprints(), current, projects=(PROJECT,))

    checkpoint = {key: value for key, value in current.items() if key != "version"}
    if version is not None:
        checkpoint["version"] = version
    assert not is_current(checkpoint)
    with pytest.raises(ValueError, match="Unsupported anomaly checkpoint version"):
        advance_org(
            rows=(),
            hourly_rows=(),
            start=START,
            end=_at(1),
            footprints=Footprints(),
            projects=(PROJECT,),
            checkpoint=checkpoint,
        )


def test_non_finite_novelty_survives_strict_json_round_trip() -> None:
    novelty = {"return_days": inf, "size": -inf, "history_days": 14}
    checkpoint = _checkpoint_with_pending_issue(novelty)
    (record,) = checkpoint["events"]
    assert record["novelty"]["return_days"] == "inf"
    assert record["novelty"]["size"] == "-inf"
    (restored,) = _restore(Footprints(), checkpoint, projects=(PROJECT,)).pending_issues
    assert restored.novelty == novelty


@pytest.mark.parametrize("index", (1, 999, -1, False, "0", 0.0))
def test_corrupt_event_reference_fails_restore(index: object) -> None:
    checkpoint = _checkpoint_with_pending_issue()
    assert len(checkpoint["events"]) == 1
    checkpoint["pending_issues"] = [index]
    with pytest.raises(ValueError, match="Invalid anomaly checkpoint event reference"):
        _restore(Footprints(), checkpoint, projects=(PROJECT,))


def test_watched_series_without_detector_rule_fails_restore() -> None:
    checkpoint = _checkpoint_with_pending_issue()
    assert checkpoint["detector"]["watched"]
    # Sampled span counts are companion series; no detector rule watches them.
    checkpoint["detector"]["watched"].append(
        [PROJECT, ENV, Signal.ENDPOINTS, Metric.COUNT_SAMPLE, ENDPOINT]
    )
    with pytest.raises(ValueError, match="Invalid anomaly checkpoint detector rule"):
        _restore(Footprints(), checkpoint, projects=(PROJECT,))


def test_empty_advance_with_narrower_scope_keeps_other_projects_hourly_support() -> None:
    keys = [
        SeriesKey(project, ENV, Signal.ENDPOINTS, Metric.P95_DURATION, ENDPOINT)
        for project in (PROJECT, 43)
    ]
    hours = [START - timedelta(days=day) for day in range(1, 8)]
    evaluator = OrgEvaluator(Footprints(), projects=(PROJECT, 43))
    for key in keys:
        evaluator.series[key] = {_at(-1): 400.0}
        evaluator.hourly[key] = dict.fromkeys(hours, 100.0)
    evaluator.series_history.refresh()
    for key in keys:
        state = evaluator.series_history.state[key]
        state.open = ChangeEvent(key, ChangeType.SLOWDOWN, _at(-1), 400.0, 100.0, 0.9)
        state.anchor_level = 100.0
    evaluator.next_minute = START

    # An empty range snapshots without reconciling scope; it must not silently
    # drop the seasonal support of open anchored episodes it still retains.
    decisions, checkpoint = advance_org(
        rows=(),
        hourly_rows=(),
        start=START,
        end=START,
        footprints=Footprints(),
        projects=(PROJECT,),
        checkpoint=_round_trip(_snapshot(evaluator, START)),
    )
    assert not decisions
    restored = _restore(Footprints(), _round_trip(checkpoint), projects=(PROJECT, 43))
    assert set(restored.series_history.state) == set(keys)
    assert restored.hourly == {key: dict.fromkeys(hours, 100.0) for key in keys}


@cell_silo_test
class TestDenseWorkerCheckpoint(TestCase):
    def test_writes_and_restores_dense_checkpoint_at_project_limit(self) -> None:
        projects = [
            self.create_project(organization=self.organization)
            for _ in range(options.get("anomaly_detection.max_projects_per_organization"))
        ]
        detectors = [
            self.create_detector(project=project, type=DetectorType.ANOMALY_DETECTION, enabled=True)
            for project in projects
        ]
        project_ids = {project.id for project in projects}
        scale = {
            "count()": 1000.0,
            "count_sample()": 100.0,
            "p95(span.duration)": 100.0,
            "failure_rate()": 0.1,
        }
        series = [
            SeriesKey(project, f"env-{env}", signal.name, metric, f"slice-{dim}")
            for project in sorted(project_ids)
            for env in range(MAX_ENVIRONMENTS)
            for signal in SPAN_SLICES
            for dim in range(MAX_SLICES)
            for metric in signal.metrics
        ]
        sampled: dict[SeriesKey, dict[datetime, float]] = {
            key: {} for key in series if key.dim_value == "slice-0" and key.env == "env-0"
        }
        # A full, non-repeating slice cohort at all project slots. Keep the
        # workload shorter than warmup while exceeding the old 8 MiB cap.
        warm_minutes = 128
        first_end = _at(warm_minutes)
        second_end = _at(warm_minutes + 1)
        rng = Random(2)

        def collect(
            organization: Organization,
            scoped_projects: Sequence[Project],
            start: datetime,
            end: datetime,
            interval: str,
        ) -> list[SeriesRow]:
            assert organization == self.organization
            assert {project.id for project in scoped_projects} == project_ids
            if interval == "1h":
                return []
            rows: list[SeriesRow] = []
            minute = max(start, START)
            while minute < end:
                capture = minute in (START, first_end)
                for key in series:
                    value = scale[key.metric] * (1 + 0.1 * rng.random())
                    rows.append(
                        SeriesRow(
                            minute,
                            key.signal,
                            key.metric,
                            key.project_id,
                            key.env,
                            key.dim_value,
                            value,
                        )
                    )
                    if capture and key in sampled:
                        sampled[key][minute] = value
                minute += timedelta(minutes=1)
            return rows

        with (
            self.feature(
                {schedule.FEATURE: True, AnomalyDetection.build_ingest_feature_name(): True}
            ),
            patch.object(schedule, "collect", side_effect=collect),
        ):
            assert not schedule._run_organization(self.organization.id, first_end)
            state = AnomalyDetectionState.objects.get(organization=self.organization)
            assert state.next_minute == first_end.replace(tzinfo=UTC)
            assert state.checkpoint is not None
            assert len(orjson.dumps(state.checkpoint)) > 8 * 1024 * 1024

            assert not schedule._run_organization(self.organization.id, second_end)
            state.refresh_from_db()
            assert state.next_minute == second_end.replace(tzinfo=UTC)

        assert state.checkpoint is not None
        restored = _restore(
            Footprints(),
            state.checkpoint,
            projects=tuple(detector.project_id for detector in detectors),
        )
        assert restored.next_minute == second_end
        assert restored.series.keys() == set(series)
        assert all(len(points) == warm_minutes + 1 for points in restored.series.values())
        for key, points in sampled.items():
            assert points.keys() == {START, first_end}
            assert all(restored.series[key][minute] == value for minute, value in points.items())
