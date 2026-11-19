from base64 import b64decode
from collections import Counter, deque
from dataclasses import replace
from datetime import datetime, timedelta
from math import copysign
from random import Random
from typing import Any

import orjson
import pytest

from sentry.anomaly_detection.checkpoint import (
    CHECKPOINT_VERSION,
    _history_floor,
    _restore,
    _snapshot,
    advance_org,
    retained_group_keys,
)
from sentry.anomaly_detection.collection import MAX_ENVIRONMENTS, MAX_SLICES, SPAN_SLICES
from sentry.anomaly_detection.contracts import ChangeEvent, ChangeType, SeriesKey, Urgency
from sentry.anomaly_detection.correlate import MemberState, episode_key
from sentry.anomaly_detection.detect import DISPERSION_MIN, CountTotals
from sentry.anomaly_detection.footprint import Footprint, SliceStats
from sentry.anomaly_detection.pipeline import AnomalyDecision, OrgEvaluator
from sentry.anomaly_detection.series import SeriesRow
from sentry.anomaly_detection.shared import PairStats
from sentry.utils import json
from tests.sentry.anomaly_detection.test_parity import make_handlers

START = datetime(2024, 1, 8, 12)
PROJECT = "42"
ENV = "production"
ENDPOINT = "/checkout"


class Footprints:
    def footprint(self, event: ChangeEvent, observation_end: datetime) -> Footprint:
        return Footprint(
            event=event.key,
            traces=["trace-1"],
            slices={(PROJECT, ENV, "endpoints", ENDPOINT): SliceStats(0.5, 400.0, 100)},
            edges=Counter({("42/production", "example.com", "43/production"): 1}),
            window=(event.start, min(observation_end, event.start + timedelta(minutes=5))),
        )


def _at(minute: int) -> datetime:
    return START + timedelta(minutes=minute)


def _round_trip(checkpoint: dict[str, Any]) -> dict[str, Any]:
    return json.loads(json.dumps(checkpoint, sort_keys=True))


def _endpoint_rows(start: int, stop: int) -> list[SeriesRow]:
    return [
        (_at(i), "endpoints", metric, PROJECT, ENV, ENDPOINT, value)
        for i in range(start, stop)
        for metric, value in (
            ("count_sample()", 100.0),
            ("p95(span.duration)", 400.0 if 120 <= i < 156 else 100.0),
        )
    ]


def test_split_slowdown_matches_continuous_activation_and_resolution() -> None:
    hourly: list[SeriesRow] = [
        (ts, "endpoints", metric, PROJECT, ENV, ENDPOINT, value)
        for hour in range(12, 16)
        for day in range(1, 15)
        for ts in [START.replace(hour=hour) - timedelta(days=day)]
        for metric, value in (("count_sample()", 6000.0), ("p95(span.duration)", 100.0))
    ]
    continuous = OrgEvaluator(Footprints(), handlers=make_handlers(PROJECT)).advance(
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
            handlers=make_handlers(PROJECT),
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
    assert retained_group_keys(checkpoint) == {opened.group_key}


def test_split_during_change_point_persistence_and_open_episode() -> None:
    def rows(start: int, stop: int) -> list[SeriesRow]:
        # A 1.45x increase is large enough for CP without opening a 1.5x spike.
        return [
            (_at(i), signal, metric, PROJECT, ENV, "", value)
            for i in range(start, stop)
            for signal, metric, value in (
                ("requests", "count()", 10000.0),
                ("requests", "count_sample()", 5000.0),
                ("errors", "count()", 145.0 if 140 <= i < 205 else 100.0),
            )
        ]

    expected, _ = advance_org(
        rows=rows(0, 250),
        hourly_rows=(),
        start=START,
        end=_at(250),
        footprints=Footprints(),
        handlers=make_handlers(PROJECT),
    )
    assert [decision.is_resolved for decision in expected] == [False, True]
    assert expected[0].evidence["change_type"] == ChangeType.CHANGE_POINT

    before_open, checkpoint = advance_org(
        rows=rows(0, 166),
        hourly_rows=(),
        start=START,
        end=_at(166),
        footprints=Footprints(),
        handlers=make_handlers(PROJECT),
    )
    opened, checkpoint = advance_org(
        rows=rows(166, 180),
        hourly_rows=(),
        start=_at(166),
        end=_at(180),
        footprints=Footprints(),
        handlers=make_handlers(PROJECT),
        checkpoint=_round_trip(checkpoint),
    )
    closed, checkpoint = advance_org(
        rows=rows(180, 250),
        hourly_rows=(),
        start=_at(180),
        end=_at(250),
        footprints=Footprints(),
        handlers=make_handlers(PROJECT),
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
            key=SeriesKey(PROJECT, ENV, "new_issue", "count_unique(user)", "123"),
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
        handlers=make_handlers(PROJECT),
        new_issues=issues,
    )
    assert [decision.is_resolved for decision in initial] == [False, True]
    (pending_index,) = checkpoint["pending_issues"]
    assert checkpoint["events"][pending_index]["issue_ids"] == [123]
    (restored_pending,) = _restore(
        Footprints(), _round_trip(checkpoint), handlers=make_handlers(PROJECT)
    ).pending_issues
    assert restored_pending.issue_ids == (123,)
    continued, checkpoint = advance_org(
        rows=(),
        hourly_rows=(),
        start=_at(46),
        end=_at(94),
        footprints=Footprints(),
        handlers=make_handlers(PROJECT),
        checkpoint=_round_trip(checkpoint),
    )
    continuous = OrgEvaluator(Footprints(), handlers=make_handlers(PROJECT)).advance(
        rows=(),
        hourly_rows=(),
        start=START,
        end=_at(94),
        new_issues=issues,
    )
    assert [decision.is_resolved for decision in continued] == [False, True]
    assert [*initial, *continued] == list(continuous)
    assert {decision.group_key for decision in continuous} == {initial[0].group_key}
    assert retained_group_keys(checkpoint) == {initial[0].group_key}


def test_minute_support_is_bounded_without_losing_the_episode_anchor_window() -> None:
    # Only the oldest minute lies beyond the detector's baseline reach-back.
    values = {_at(0): 100.0, _at(1): -0.0, _at(70): None, _at(1569): 1 / 3}
    _, checkpoint = advance_org(
        rows=[(ts, "requests", "count()", PROJECT, ENV, "", value) for ts, value in values.items()]
        + [(_at(0), "requests", "count()", PROJECT, "staging", "", 100.0)],
        hourly_rows=(),
        start=START,
        end=_at(1570),
        footprints=Footprints(),
        handlers=make_handlers(PROJECT),
    )
    restored = _restore(Footprints(), _round_trip(checkpoint), handlers=make_handlers(PROJECT))
    assert restored.series == {
        SeriesKey(PROJECT, ENV, "requests", "count()"): {
            ts: value for ts, value in values.items() if ts != START
        },
        SeriesKey(PROJECT, "staging", "requests", "count()"): {},
    }
    restored_zero = restored.series[SeriesKey(PROJECT, ENV, "requests", "count()")][_at(1)]
    assert restored_zero is not None and copysign(1, restored_zero) == -1


def test_dense_collector_checkpoint_round_trips_at_full_history_depth() -> None:
    evaluator = OrgEvaluator(Footprints(), handlers=make_handlers(PROJECT))
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
                        key = SeriesKey(str(project), env, signal.name, metric, f"slice-{dim}")
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
    restored = _restore(
        Footprints(), orjson.loads(orjson.dumps(checkpoint)), handlers=make_handlers(PROJECT)
    )
    assert restored.series == series
    assert restored.series_history.state == evaluator.series_history.state


def test_rotating_full_slice_cohorts_bound_checkpoint_state() -> None:
    checkpoint = None
    for batch in range(5):
        _, checkpoint = advance_org(
            rows=[
                (
                    _at(batch),
                    "endpoints",
                    metric,
                    PROJECT,
                    f"env-{env}",
                    f"/route/{batch}/{dim}",
                    value,
                )
                for env in range(MAX_ENVIRONMENTS)
                for dim in range(MAX_SLICES)
                for metric, value in (("count_sample()", 500.0), ("failure_rate()", 0.02))
            ],
            hourly_rows=(),
            start=_at(batch),
            end=_at(batch + 1),
            footprints=Footprints(),
            handlers=make_handlers(PROJECT),
            checkpoint=None if checkpoint is None else _round_trip(checkpoint),
        )
    assert checkpoint is not None
    restored = _restore(Footprints(), _round_trip(checkpoint), handlers=make_handlers(PROJECT))
    expected_keys = {
        SeriesKey(PROJECT, f"env-{env}", "endpoints", "failure_rate()", f"/route/{batch}/{dim}")
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
        replace(key, metric="count_sample()") for key in expected_keys
    }
    assert all(state.counts for state in restored.series_history.state.values())
    assert restored.novelty.coverage.keys() == {
        SeriesKey(PROJECT, f"env-{env}", "endpoints", "failure_rate()", f"/route/{batch}/{dim}")
        for env in range(MAX_ENVIRONMENTS)
        for dim in range(MAX_SLICES)
        for batch in (1, 2, 3, 4)
    }


def test_stale_slice_evicts_watch_state_but_keeps_aggregate_presence() -> None:
    stale = SeriesKey(PROJECT, ENV, "endpoints", "failure_rate()", "/retired")
    current = replace(stale, dim_value=ENDPOINT)
    total = SeriesKey(PROJECT, ENV, "requests", "count()")
    _, checkpoint = advance_org(
        rows=[
            (START, stale.signal, stale.metric, PROJECT, ENV, stale.dim_value, 0.1),
            (START, stale.signal, "count_sample()", PROJECT, ENV, stale.dim_value, 100.0),
            (START, total.signal, total.metric, PROJECT, ENV, "", 100.0),
        ],
        hourly_rows=(),
        start=START,
        end=_at(1),
        footprints=Footprints(),
        handlers=make_handlers(PROJECT),
    )
    before = _restore(Footprints(), checkpoint, handlers=make_handlers(PROJECT))
    assert before.series_history.state[stale].counts
    before.series_history.exclude = {stale: "unreliable metrics"}
    _, checkpoint = advance_org(
        rows=[(_at(1569), current.signal, current.metric, PROJECT, ENV, current.dim_value, None)],
        hourly_rows=(),
        start=_at(1),
        end=_at(1570),
        footprints=Footprints(),
        handlers=make_handlers(PROJECT),
        checkpoint=_round_trip(_snapshot(before, _at(1))),
    )
    restored = _restore(Footprints(), _round_trip(checkpoint), handlers=make_handlers(PROJECT))
    assert restored.series == {total: {}, current: {_at(1569): None}}
    assert (
        restored.series_history.watched.keys()
        == restored.series_history.state.keys()
        == {total, current}
    )
    assert stale not in restored.series_history.exclude
    # Retiring minute data does not lose recent novelty exposure.
    assert restored.novelty.coverage[stale][START] == 1


def test_unobserved_open_slice_expires_without_claiming_recovery() -> None:
    key = SeriesKey(PROJECT, ENV, "endpoints", "p95(span.duration)", ENDPOINT)
    event = ChangeEvent(
        key, ChangeType.SLOWDOWN, START, 400.0, 100.0, 0.9, open_ratio=4.0, sustained_at=_at(30)
    )
    evaluator = OrgEvaluator(Footprints(), handlers=make_handlers(PROJECT))
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
        handlers=make_handlers(PROJECT),
        checkpoint=_round_trip(_snapshot(evaluator, _at(31))),
    )
    assert not decisions
    assert (
        key
        in _restore(Footprints(), checkpoint, handlers=make_handlers(PROJECT)).series_history.state
    )
    decisions, checkpoint = advance_org(
        rows=(),
        hourly_rows=(),
        start=_at(1569),
        end=_at(1570),
        footprints=Footprints(),
        handlers=make_handlers(PROJECT),
        checkpoint=_round_trip(checkpoint),
    )
    assert not decisions  # The correlator still observes its normal quiet window.
    restored = _restore(Footprints(), checkpoint, handlers=make_handlers(PROJECT))
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
        handlers=make_handlers(PROJECT),
        checkpoint=_round_trip(checkpoint),
    )
    assert list(decisions) == [replace(opened, timestamp=_at(1584), is_resolved=True)]


def test_checkpoint_prunes_old_group_members_without_losing_live_aliases() -> None:
    evaluator = OrgEvaluator(Footprints(), handlers=make_handlers(PROJECT))
    key = SeriesKey(PROJECT, ENV, "endpoints", "p95(span.duration)", ENDPOINT)
    root = ChangeEvent(key, ChangeType.SLOWDOWN, START, 400.0, 100.0, 0.9, ended_at=_at(5))
    evaluator.corr.step(START, [("open", root)])
    (group,) = evaluator.corr.groups
    group.members[episode_key(root)].closed_at = _at(5)

    alias_key = replace(key, dim_value="/alias")
    old = replace(root, key=alias_key, start=_at(1))
    live = replace(old, start=_at(400), ended_at=None)
    recent = replace(old, start=_at(390), ended_at=_at(395))
    group.members[episode_key(old)] = MemberState(old, 4.0, closed_at=old.ended_at)
    group.members[episode_key(live)] = MemberState(live, 4.0, representative=episode_key(old))
    group.members[episode_key(recent)] = MemberState(
        recent, 4.0, closed_at=recent.ended_at, representative=episode_key(old)
    )
    group.group.change_events.extend((old, live, recent))
    evaluator.next_minute = _at(410)

    checkpoint = _round_trip(_snapshot(evaluator, _at(410)))
    restored = _restore(Footprints(), checkpoint, handlers=make_handlers(PROJECT))
    (continued,) = restored.corr.groups
    assert continued.root == root
    assert continued.group.change_events == [root, live, recent]
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
        handlers=make_handlers(PROJECT),
    )
    assert checkpoint["novelty"]["history"]
    assert checkpoint["novelty"]["coverage"]
    _, checkpoint = advance_org(
        rows=(),
        hourly_rows=(),
        start=_at(200),
        end=_at(200) + timedelta(days=15),
        footprints=Footprints(),
        handlers=make_handlers(PROJECT),
        checkpoint=_round_trip(checkpoint),
    )
    assert not checkpoint["novelty"]["history"]
    assert not checkpoint["novelty"]["coverage"]


@pytest.mark.parametrize(("published_owner", "emit_close"), ((PROJECT, True), ("43", False)))
def test_project_scope_change_retires_mixed_group_without_rebinding(
    published_owner: str, emit_close: bool
) -> None:
    disabled = "43"
    retained_key = SeriesKey(PROJECT, ENV, "endpoints", "p95(span.duration)", ENDPOINT)
    removed_key = SeriesKey(disabled, ENV, "endpoints", "p95(span.duration)", ENDPOINT)
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
    evaluator = OrgEvaluator(Footprints(), handlers=make_handlers(PROJECT, disabled))
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
    assert opened.project_id == int(PROJECT)
    assert mixed.group.change_events == [retained, removed]
    assert evaluator.corr.state.edges
    # Even when correlation's current root has changed, the published owner is
    # pinned to the decision. Simulate both owners to cover both close paths.
    mixed.root = removed
    opened = replace(opened, project_id=int(published_owner), env="published-env")
    evaluator.qualified[opened.group_key] = opened

    # Persist additional disabled-project state beyond the group's events.
    cp_key = SeriesKey(disabled, ENV, "error_rate", "errors/requests")
    evaluator.series[cp_key] = {_at(30): 0.01}
    evaluator.rate_shifts.refresh()
    evaluator.rate_shifts.state[cp_key].hits = 2
    a = (f"{PROJECT}/{ENV}", "outbound_http", "example.com")
    b = (f"{disabled}/{ENV}", "outbound_http", "example.com")
    evaluator.corr.shared.pairs[frozenset((a, b))] = PairStats(a, b, 5, 5, 5, 0.1, 0.001)
    pending = ChangeEvent(
        SeriesKey(disabled, ENV, "new_issue", "count_unique(user)", "123"),
        ChangeType.NEW_FAILURE_MODE,
        _at(32),
        10.0,
        10.0,
        0.9,
    )
    evaluator.pending_issues.append(pending)
    evaluator.next_minute = _at(32)

    decisions, checkpoint = advance_org(
        rows=[(_at(32), "requests", "count()", disabled, ENV, "", 100.0)],
        hourly_rows=(),
        start=_at(32),
        end=_at(33),
        footprints=Footprints(),
        handlers=make_handlers(PROJECT),
        new_issues=[pending],
        checkpoint=_round_trip(_snapshot(evaluator, _at(32))),
    )
    assert len(decisions) == int(emit_close)
    assert all(
        decision == replace(opened, timestamp=_at(32), is_resolved=True) for decision in decisions
    )
    assert not retained_group_keys(checkpoint)
    restored = _restore(Footprints(), checkpoint, handlers=make_handlers(PROJECT))
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


@pytest.mark.parametrize("checkpoint", ({}, {"version": CHECKPOINT_VERSION - 1}, {"version": True}))
def test_unsupported_checkpoint_version_fails_without_advancing(checkpoint: dict[str, Any]) -> None:
    with pytest.raises(ValueError, match="Unsupported anomaly checkpoint version"):
        advance_org(
            rows=(),
            hourly_rows=(),
            start=START,
            end=_at(1),
            footprints=Footprints(),
            handlers=make_handlers(PROJECT),
            checkpoint=checkpoint,
        )
