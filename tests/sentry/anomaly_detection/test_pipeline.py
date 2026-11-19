from dataclasses import replace
from datetime import datetime, timedelta
from unittest.mock import patch

from sentry.anomaly_detection.checkpoint.codec import _snapshot
from sentry.anomaly_detection.checkpoint.replay import advance_org
from sentry.anomaly_detection.contracts import (
    AnomalyGroup,
    AnomalyGroupKey,
    ChangeEvent,
    ChangeType,
    Metric,
    SeriesKey,
    SeriesRow,
    Service,
    Signal,
    Urgency,
)
from sentry.anomaly_detection.correlation.correlator import GroupAction
from sentry.anomaly_detection.correlation.footprint import Footprint
from sentry.anomaly_detection.evaluation.organization import OrgEvaluator, evaluate_org
from sentry.utils import json

T0 = datetime(2020, 11, 2, 12)
MINUTE = timedelta(minutes=1)
PROJECT = 42


class NoFootprints:
    def footprint(self, event: ChangeEvent, observation_end: datetime) -> Footprint | None:
        return None


def _db_row(t: datetime, metric: Metric, value: float) -> SeriesRow:
    return SeriesRow(t, Signal.OUTBOUND_DB, metric, PROJECT, "prod", "primary", value)


def latency_rows(
    *, spike_end: int, missing_from: int | None = None, end: int = 250
) -> list[SeriesRow]:
    rows: list[SeriesRow] = []
    for i in range(end):
        t = T0 + i * MINUTE
        if missing_from is not None and missing_from <= i < spike_end:
            # The dependency percentile still appears, but its sample count is absent.
            rows.append(_db_row(t, Metric.P95_DURATION, 0.0))
            continue
        p95 = (30.0 + i % 3) * (15 if 120 <= i < spike_end else 1)
        rows.extend(
            [
                _db_row(t, Metric.P95_DURATION, p95),
                _db_row(t, Metric.COUNT_SAMPLE, 500.0),
            ]
        )
    return rows


def test_minute_observations_open_and_resolve_the_same_group() -> None:
    start = T0 + 120 * MINUTE
    end = T0 + 250 * MINUTE
    rows = latency_rows(spike_end=165)
    (opened, resolved) = evaluate_org(
        rows=rows,
        hourly_rows=[],
        start=start,
        end=end,
        footprints=NoFootprints(),
        projects=(PROJECT,),
    )

    assert not opened.is_resolved
    assert opened.urgency == Urgency.MEDIUM
    assert opened.project_id == 42
    assert opened.env == "prod"
    assert opened.evidence["actual"] == 480.0
    assert opened.evidence["started_at"] == start.isoformat()
    assert "primary" not in str(opened.evidence)
    assert opened.timestamp >= start + 30 * MINUTE
    assert resolved == replace(opened, timestamp=resolved.timestamp, is_resolved=True)
    assert T0 + 165 * MINUTE < resolved.timestamp < end

    # A fresh replay with a different input order computes the same identity and lifecycle.
    assert [opened, resolved] == evaluate_org(
        rows=rows[::-1],
        hourly_rows=[],
        start=start,
        end=end,
        footprints=NoFootprints(),
        projects=(PROJECT,),
    )


def test_absent_sample_source_does_not_resolve_an_open_change() -> None:
    start = T0 + 120 * MINUTE
    gap_end = T0 + 230 * MINUTE
    end = T0 + 300 * MINUTE
    rows = latency_rows(spike_end=230, missing_from=165, end=300)
    evaluator = OrgEvaluator(NoFootprints(), projects=(PROJECT,))
    before_gap = [row for row in rows if row.ts < gap_end]
    after_gap = [row for row in rows if row.ts >= gap_end]
    (opened,) = evaluator.advance(rows=before_gap, hourly_rows=[], start=start, end=gap_end)
    assert not opened.is_resolved

    (resolved,) = evaluator.advance(rows=after_gap, hourly_rows=[], start=gap_end, end=end)
    assert resolved.timestamp > gap_end
    assert resolved == replace(opened, timestamp=resolved.timestamp, is_resolved=True)


def test_unusual_but_short_single_slowdown_does_not_qualify() -> None:
    start = T0 + 120 * MINUTE
    # Past the 30 minutes a lone latency group needs before it can qualify on duration.
    end = T0 + 160 * MINUTE
    evaluator = OrgEvaluator(NoFootprints(), projects=(PROJECT,))
    assert not evaluator.advance(
        rows=latency_rows(spike_end=132), hourly_rows=[], start=start, end=end
    )
    (group,) = evaluator.corr.groups
    assert group.group.urgency == Urgency.LOW
    assert group.closed_at is None

    # The same slowdown, lasting through the window, does publish.
    lasting = OrgEvaluator(NoFootprints(), projects=(PROJECT,))
    (opened,) = lasting.advance(
        rows=latency_rows(spike_end=200), hourly_rows=[], start=start, end=end
    )
    assert not opened.is_resolved
    assert opened.timestamp >= start + 30 * MINUTE


def _routine_slowdown_rows(*, flare_minutes: int = 5) -> list[SeriesRow]:
    rows: list[SeriesRow] = []
    short_flares = [(i, i + flare_minutes) for i in range(120, 480, 60)]
    for i in range(550):
        t = T0 + i * MINUTE
        slow = i >= 480 or any(lo <= i < hi for lo, hi in short_flares)
        rows.extend(
            [
                _db_row(t, Metric.P95_DURATION, 450.0 if slow else 30.0),
                _db_row(t, Metric.COUNT_SAMPLE, 500.0),
            ]
        )
    return rows


def test_routine_slowdown_qualifies_when_it_lasts_unusually_long() -> None:
    start = T0 + 480 * MINUTE
    duration_look = start + 60 * MINUTE
    rows = _routine_slowdown_rows()

    evaluator = OrgEvaluator(NoFootprints(), projects=(PROJECT,))
    assert not evaluator.advance(rows=rows, hourly_rows=[], start=start, end=duration_look)
    (latent,) = evaluator.absorbed.values()
    assert latent.start == start and latent.sustained_at is not None

    (opened,) = evaluator.advance(
        rows=rows, hourly_rows=[], start=duration_look, end=duration_look + MINUTE
    )
    assert opened.timestamp == duration_look
    assert not opened.is_resolved
    assert not evaluator.absorbed


def test_duration_promotion_waits_for_supported_anomaly_after_gap() -> None:
    start = T0 + 480 * MINUTE
    first_look = start + 60 * MINUTE
    healthy_return = first_look + 5 * MINUTE
    unsupported_return = healthy_return + MINUTE
    supported_return = unsupported_return + MINUTE
    rows: list[SeriesRow] = []
    for row in _routine_slowdown_rows():
        if first_look <= row.ts < healthy_return:
            continue
        if row.ts == healthy_return and row.metric == Metric.P95_DURATION:
            row = row._replace(value=30.0)
        elif row.ts == unsupported_return and row.metric == Metric.COUNT_SAMPLE:
            row = row._replace(value=1.0)
        rows.append(row)
    evaluator = OrgEvaluator(NoFootprints(), projects=(PROJECT,))
    assert not evaluator.advance(rows=rows, hourly_rows=[], start=start, end=first_look)
    checkpoint = json.loads(json.dumps(_snapshot(evaluator, first_look)))

    assert not evaluator.advance(rows=rows, hourly_rows=[], start=first_look, end=supported_return)
    (latent,) = evaluator.absorbed.values()
    assert evaluator.novelty.observed_duration(latent, supported_return) == 61
    assert not evaluator.next_look

    expected = evaluator.advance(
        rows=rows, hourly_rows=[], start=supported_return, end=supported_return + MINUTE
    )
    (opened,) = expected
    assert opened.timestamp == supported_return and not opened.is_resolved
    assert latent.novelty and latent.novelty["opened_on_duration"] is True

    # A restarted poll catches up through the gap and healthy return, publishing
    # exactly what the uninterrupted evaluator published from the checkpoint on.
    restarted, _ = advance_org(
        rows=rows,
        hourly_rows=[],
        start=first_look,
        end=supported_return + MINUTE,
        footprints=NoFootprints(),
        projects=(PROJECT,),
        checkpoint=checkpoint,
    )
    assert list(restarted) == [opened]


def test_duration_judgment_does_not_see_backdated_peer_opened_on_same_tick() -> None:
    start = T0 + 480 * MINUTE
    duration_look = start + 60 * MINUTE
    peer_key = SeriesKey(PROJECT, "prod", Signal.OUTBOUND_DB, Metric.P95_DURATION, "peer")
    rows = _routine_slowdown_rows(flare_minutes=3) + [
        SeriesRow(
            T0 + i * MINUTE,
            peer_key.signal,
            metric,
            peer_key.project_id,
            peer_key.env,
            peer_key.dim_value,
            value,
        )
        for i in range(541)
        for metric, value in (
            (peer_key.metric, 450.0 if i in (536, 538, 540) else 30.0),
            (Metric.COUNT_SAMPLE, 500.0),
        )
    ]
    evaluator = OrgEvaluator(NoFootprints(), projects=(PROJECT,))
    evaluator.series_history.cfg.close_after = 1
    assert not evaluator.advance(rows=rows, hourly_rows=[], start=start, end=duration_look)
    (latent,) = evaluator.absorbed.values()
    # Only the peer's four backdated minutes qualify; the past flares lasted three.
    evaluator.novelty.cfg.comparable = 15.0
    prior = evaluator.novelty.judge_duration(latent, 60, duration_look)
    assert prior.unusual

    evaluator.advance(rows=rows, hourly_rows=[], start=duration_look, end=duration_look + MINUTE)

    (peer,) = evaluator.novelty.history[peer_key]
    assert peer.event.detected_at == duration_look
    assert evaluator.novelty.observed_duration(peer.event, duration_look) == 4
    assert latent.novelty == prior.as_dict() | {"opened_on_duration": True}
    assert (
        evaluator.novelty.judge_duration(latent, 60, duration_look).pooled_rate > prior.pooled_rate
    )


def test_new_failure_mode_opens_only_after_crossing_the_standalone_threshold() -> None:
    weak_at = T0 + 3 * MINUTE
    detected_at = T0 + 5 * MINUTE
    issue = ChangeEvent(
        SeriesKey(PROJECT, "prod", Signal.NEW_ISSUE, Metric.COUNT_UNIQUE_USER, "PRIVATE-42"),
        ChangeType.NEW_FAILURE_MODE,
        T0,
        actual=60.0,
        expected=60.0,
        confidence=0.9,
        detected_at=detected_at,
        evidence=["private failure payload", "issues:PRIVATE-42"],
    )
    weak = replace(issue, actual=10.0, confidence=0.5, detected_at=weak_at)
    evaluator = OrgEvaluator(NoFootprints(), projects=(PROJECT,))
    assert not evaluator.advance(
        rows=[], hourly_rows=[], start=T0, end=detected_at, new_issues=[weak]
    )
    assert len(evaluator.known_issues) == 1  # the weak crossing was seen but did not open
    (opened,) = evaluator.advance(
        rows=[],
        hourly_rows=[],
        start=detected_at,
        end=detected_at + MINUTE,
        new_issues=[weak, issue, issue],
    )
    assert opened.timestamp == detected_at
    assert not opened.is_resolved
    assert "PRIVATE-42" not in repr(opened)
    assert "private failure payload" not in repr(opened)
    assert issue.ended_at is None


def test_first_qualification_pins_the_owner_through_reroot_and_merge() -> None:
    selected = ChangeEvent(
        SeriesKey(PROJECT, "prod", Signal.ENDPOINTS, Metric.P95_DURATION, "/private"),
        ChangeType.SLOWDOWN,
        T0,
        actual=700.0,
        expected=40.0,
        confidence=0.9,
    )
    other = ChangeEvent(
        SeriesKey(93, "staging", Signal.ERRORS, Metric.COUNT_UNIQUE_USER),
        ChangeType.SPIKE,
        T0,
        actual=50.0,
        expected=1.0,
        confidence=0.9,
        evidence=["private cross-project details"],
    )
    group = AnomalyGroup(
        AnomalyGroupKey("stable-group"),
        T0,
        [selected, other],
        blast_radius=[Service(PROJECT, "prod"), Service(93, "staging")],
    )
    evaluator = OrgEvaluator(NoFootprints(), projects=(PROJECT, 93))
    assert not evaluator._decisions([GroupAction(T0, "open", group, root=selected)])

    (opened,) = evaluator._decisions(
        [GroupAction(T0 + MINUTE, "join", group, root=selected, independent_count=2)]
    )
    assert opened.urgency == Urgency.LOW
    assert opened.project_id == 42
    assert opened.env == "prod"
    assert opened.evidence == {
        "signal": "endpoints",
        "change_type": "slowdown",
        "started_at": T0.isoformat(),
        "actual": 700.0,
        "expected": 40.0,
        "confidence": 0.9,
    }

    group.urgency = Urgency.HIGH
    (updated,) = evaluator._decisions(
        [GroupAction(T0 + 2 * MINUTE, "urgency", group, root=other, independent_count=2)]
    )
    assert updated == replace(opened, timestamp=T0 + 2 * MINUTE, urgency=Urgency.HIGH)
    (resolved,) = evaluator._decisions(
        [
            GroupAction(
                T0 + 3 * MINUTE,
                "close",
                group,
                root=other,
                merged_into=AnomalyGroupKey("other-project-group"),
            )
        ]
    )
    assert resolved == replace(updated, timestamp=T0 + 3 * MINUTE, is_resolved=True)


def test_cold_start_does_not_publish_a_group_that_closes_on_the_boundary() -> None:
    failure = ChangeEvent(
        SeriesKey(PROJECT, "prod", Signal.NEW_ISSUE, Metric.COUNT_UNIQUE_USER, "42"),
        ChangeType.NEW_FAILURE_MODE,
        T0,
        actual=60.0,
        expected=10.0,
        confidence=0.9,
    )
    closes_at = T0 + timedelta(minutes=45)

    # Active just before the boundary, so a cold start there publishes it.
    (active,) = evaluate_org(
        rows=[],
        hourly_rows=[],
        start=closes_at - MINUTE,
        end=closes_at,
        footprints=NoFootprints(),
        projects=(PROJECT,),
        new_issues=[failure],
    )
    assert active.timestamp == closes_at - MINUTE
    assert not active.is_resolved

    assert not evaluate_org(
        rows=[],
        hourly_rows=[],
        start=closes_at,
        end=closes_at + MINUTE,
        footprints=NoFootprints(),
        projects=(PROJECT,),
        new_issues=[replace(failure)],
    )


def test_simultaneous_excursions_do_not_change_each_others_prior() -> None:
    left_key = SeriesKey(PROJECT, "prod", Signal.ENDPOINTS, Metric.P95_DURATION, "/left")
    right_key = replace(left_key, dim_value="/right")
    candidate_minute = T0 + timedelta(hours=12)
    candidate = ChangeEvent(left_key, ChangeType.SLOWDOWN, candidate_minute, 40.0, 20.0, 0.9)
    peer = replace(candidate, key=right_key)
    evaluator = OrgEvaluator(NoFootprints(), projects=(PROJECT,))
    for offset in range(720):
        minute = T0 + offset * MINUTE
        evaluator.novelty.observe(left_key, minute)
        evaluator.novelty.observe(right_key, minute)
    earlier = replace(candidate, start=T0 + MINUTE)
    evaluator.novelty.record(earlier)
    prior = evaluator.novelty.judge(candidate, 1.0, candidate_minute)

    # Drive the production minute step with both endpoints opening in the same minute.
    with patch.object(
        evaluator,
        "_evaluate_project_measurements",
        lambda minute, rows: [("open", peer), ("open", candidate)],
    ):
        evaluator._step(candidate_minute, [])

    assert candidate.novelty == prior.as_dict()
    # Both opens are recorded, but only after judging.
    assert [item.event for item in evaluator.novelty.history[left_key]] == [earlier, candidate]
    assert [item.event for item in evaluator.novelty.history[right_key]] == [peer]


def test_healthy_measurements_restore_latency_detection() -> None:
    evaluator = OrgEvaluator(NoFootprints(), projects=(PROJECT,))
    key = SeriesKey(PROJECT, "prod", Signal.OUTBOUND_DB, Metric.P95_DURATION, "primary")
    rows = [
        SeriesRow(
            T0 + offset * MINUTE, key.signal, metric, key.project_id, key.env, key.dim_value, value
        )
        for offset in range(180)
        for metric, value in (
            (Metric.P95_DURATION, 0.0 if offset < 70 else 100.0),
            (Metric.COUNT_SAMPLE, 100.0),
        )
    ]
    middle = T0 + 61 * MINUTE
    evaluator.advance(rows=rows, hourly_rows=[], start=T0, end=middle)
    assert key in evaluator.series_history.exclude

    evaluator.advance(rows=rows, hourly_rows=[], start=middle, end=T0 + 121 * MINUTE)
    assert key not in evaluator.series_history.exclude
    assert key in evaluator.series_history.watched
