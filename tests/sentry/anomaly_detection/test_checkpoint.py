from collections import Counter
from datetime import datetime, timedelta
from typing import Any

import orjson
import pytest

from sentry.anomaly_detection.checkpoint import (
    _restore,
    _snapshot,
    advance_org,
    retained_group_keys,
)
from sentry.anomaly_detection.contracts import ChangeEvent, ChangeType, SeriesKey, Urgency
from sentry.anomaly_detection.correlate import episode_key
from sentry.anomaly_detection.footprint import Footprint, SliceStats
from sentry.anomaly_detection.pipeline import AnomalyDecision, OrgEvaluator
from sentry.anomaly_detection.series import SeriesRow
from sentry.anomaly_detection.shared import PairStats
from sentry.utils import json

START = datetime(2024, 1, 8, 12)
PROJECT = "42"
ENV = "production"
ENDPOINT = "/checkout"


class Footprints:
    def footprint(self, event: ChangeEvent) -> Footprint:
        return Footprint(
            event=event.key,
            traces=["trace-1"],
            slices={(PROJECT, ENV, "endpoints", ENDPOINT): SliceStats(0.5, 400.0, 100)},
            edges=Counter({("42/production", "example.com", "43/production"): 1}),
            window=(event.start, event.start + timedelta(minutes=5)),
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
    continuous = OrgEvaluator(Footprints()).advance(
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
    )
    assert [decision.is_resolved for decision in expected] == [False, True]
    assert expected[0].evidence["change_type"] == ChangeType.CHANGE_POINT

    before_open, checkpoint = advance_org(
        rows=rows(0, 166),
        hourly_rows=(),
        start=START,
        end=_at(166),
        footprints=Footprints(),
    )
    opened, checkpoint = advance_org(
        rows=rows(166, 180),
        hourly_rows=(),
        start=_at(166),
        end=_at(180),
        footprints=Footprints(),
        checkpoint=_round_trip(checkpoint),
    )
    closed, checkpoint = advance_org(
        rows=rows(180, 250),
        hourly_rows=(),
        start=_at(180),
        end=_at(250),
        footprints=Footprints(),
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
        new_issues=issues,
    )
    assert [decision.is_resolved for decision in initial] == [False, True]
    continued, checkpoint = advance_org(
        rows=(),
        hourly_rows=(),
        start=_at(46),
        end=_at(94),
        footprints=Footprints(),
        checkpoint=_round_trip(checkpoint),
        current_projects={PROJECT},
    )
    continuous = OrgEvaluator(Footprints()).advance(
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
    )
    restored = _restore(Footprints(), _round_trip(checkpoint))
    assert restored.series == {
        SeriesKey(PROJECT, ENV, "requests", "count()"): {
            ts: value for ts, value in values.items() if ts != START
        },
        SeriesKey(PROJECT, "staging", "requests", "count()"): {},
    }


def test_dense_minute_support_fits_checkpoint_capacity() -> None:
    evaluator = OrgEvaluator(Footprints())
    evaluator.next_minute = _at(1569)
    minutes = [_at(i) for i in range(1569)]
    evaluator.series.update(
        {
            SeriesKey(str(project), ENV, "endpoints", "p95(span.duration)", f"/endpoint/{dim}"): {
                ts: (i + dim + 1) / 97 for i, ts in enumerate(minutes)
            }
            for project in range(10)
            for dim in range(33)
        }
    )
    evaluator.det.refresh()

    encoded = orjson.dumps(_snapshot(evaluator, _at(1569)))
    assert len(encoded) < 8 * 1024 * 1024
    restored = _restore(Footprints(), orjson.loads(encoded))
    assert restored.series == evaluator.series


def test_novelty_retains_recent_excursions_but_ages_out_old_ones() -> None:
    _, checkpoint = advance_org(
        rows=_endpoint_rows(0, 200),
        hourly_rows=(),
        start=START,
        end=_at(200),
        footprints=Footprints(),
    )
    assert checkpoint["novelty"]["history"]
    _, checkpoint = advance_org(
        rows=(),
        hourly_rows=(),
        start=_at(200),
        end=_at(200) + timedelta(days=15),
        footprints=Footprints(),
        checkpoint=_round_trip(checkpoint),
    )
    assert not checkpoint["novelty"]["history"]
    assert checkpoint["novelty"]["first_seen"] == [
        [[PROJECT, ENV, "endpoints", "p95(span.duration)", ENDPOINT], START.isoformat()]
    ]


def test_project_scope_change_retires_mixed_group_without_rebinding() -> None:
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
    evaluator = OrgEvaluator(Footprints())
    for event in (retained, removed):
        evaluator.series[event.key] = {event.start: event.actual}
        evaluator.novelty.observe(event.key, event.start)
        evaluator.novelty.record(event)
    evaluator.det.refresh()
    for event in (retained, removed):
        evaluator.det.state[event.key].open = event

    evaluator._decisions(evaluator.corr.step(START, [("open", retained)]))
    (opened,) = evaluator._decisions(evaluator.corr.step(_at(30), []))
    evaluator._decisions(evaluator.corr.step(_at(31), [("open", removed)]))
    mixed = evaluator.corr.state.open_groups[opened.group_key]
    assert opened.project_id == int(PROJECT)
    assert mixed.group.change_events == [retained, removed]
    assert evaluator.corr.state.edges

    # Persist additional disabled-project state beyond the group's events.
    cp_key = SeriesKey(disabled, ENV, "error_rate", "errors/requests")
    evaluator.series[cp_key] = {_at(30): 0.01}
    evaluator.cp.refresh()
    evaluator.cp.state[cp_key].hits = 2
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
        new_issues=[pending],
        checkpoint=_round_trip(_snapshot(evaluator, _at(32))),
        current_projects={PROJECT},
    )
    assert not decisions
    assert not retained_group_keys(checkpoint)
    restored = _restore(Footprints(), checkpoint)
    assert set(restored.series) == {retained_key}
    assert set(restored.det.state) == {retained_key}
    assert set(restored.novelty.first_seen) == set(restored.novelty.history) == {retained_key}
    assert not restored.cp.state
    assert not restored.pending_issues
    assert not restored.known_issues
    assert not restored.corr.groups
    assert not restored.corr.by_event
    assert not restored.corr.state.edges
    assert not restored.corr.state.edge_seen_at
    assert not restored.corr.shared.pairs
    candidate = restored.corr.state.latent[episode_key(retained)]
    assert candidate is restored.det.state[retained_key].open
    assert len(checkpoint["events"]) == 1


@pytest.mark.parametrize("checkpoint", ({}, {"version": 1}, {"version": 3}, {"version": True}))
def test_unsupported_checkpoint_version_fails_without_advancing(checkpoint: dict[str, Any]) -> None:
    with pytest.raises(ValueError, match="Unsupported anomaly checkpoint version"):
        advance_org(
            rows=(),
            hourly_rows=(),
            start=START,
            end=_at(1),
            footprints=Footprints(),
            checkpoint=checkpoint,
        )
