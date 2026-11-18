from dataclasses import replace
from datetime import datetime, timedelta

from sentry.anomaly_detection.contracts import (
    AnomalyGroup,
    ChangeEvent,
    ChangeType,
    SeriesKey,
    Urgency,
)
from sentry.anomaly_detection.correlate import GroupAction
from sentry.anomaly_detection.footprint import Footprint
from sentry.anomaly_detection.pipeline import OrgEvaluator, evaluate_org
from sentry.anomaly_detection.series import SeriesRow

T0 = datetime(2020, 11, 2, 12)
MINUTE = timedelta(minutes=1)


class NoFootprints:
    def footprint(self, event: ChangeEvent) -> Footprint | None:
        return None


def latency_rows(
    *, spike_end: int, missing_from: int | None = None, end: int = 250
) -> list[SeriesRow]:
    rows: list[SeriesRow] = []
    for i in range(end):
        t = T0 + i * MINUTE
        if missing_from is not None and missing_from <= i < spike_end:
            # The dependency percentile still appears, but its sample count is absent.
            rows.append((t, "outbound_db", "p95(span.duration)", "42", "prod", "primary", 0.0))
            continue
        p95 = (30.0 + i % 3) * (15 if 120 <= i < spike_end else 1)
        rows.extend(
            [
                (t, "outbound_db", "p95(span.duration)", "42", "prod", "primary", p95),
                (t, "outbound_db", "count_sample()", "42", "prod", "primary", 500.0),
            ]
        )
    return rows


def test_minute_observations_open_and_resolve_the_same_group() -> None:
    start = T0 + 120 * MINUTE
    end = T0 + 250 * MINUTE
    rows = latency_rows(spike_end=165)
    (opened, resolved) = evaluate_org(
        rows=rows, hourly_rows=[], start=start, end=end, footprints=NoFootprints()
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
        rows=rows[::-1], hourly_rows=[], start=start, end=end, footprints=NoFootprints()
    )


def test_absent_sample_source_does_not_resolve_an_open_change() -> None:
    start = T0 + 120 * MINUTE
    gap_end = T0 + 230 * MINUTE
    end = T0 + 300 * MINUTE
    rows = latency_rows(spike_end=230, missing_from=165, end=300)
    evaluator = OrgEvaluator(NoFootprints())
    before_gap = [row for row in rows if row[0] < gap_end]
    after_gap = [row for row in rows if row[0] >= gap_end]
    (opened,) = evaluator.advance(rows=before_gap, hourly_rows=[], start=start, end=gap_end)
    assert not opened.is_resolved

    (resolved,) = evaluator.advance(rows=after_gap, hourly_rows=[], start=gap_end, end=end)
    assert resolved.timestamp > gap_end
    assert resolved == replace(opened, timestamp=resolved.timestamp, is_resolved=True)


def test_unusual_but_short_single_slowdown_does_not_qualify() -> None:
    start = T0 + 120 * MINUTE
    end = T0 + 140 * MINUTE
    evaluator = OrgEvaluator(NoFootprints())
    assert not evaluator.advance(
        rows=latency_rows(spike_end=132), hourly_rows=[], start=start, end=end
    )
    (group,) = evaluator.corr.groups
    assert group.group.urgency == Urgency.LOW
    assert group.closed_at is None


def test_routine_slowdown_qualifies_when_it_lasts_unusually_long() -> None:
    start = T0 + 480 * MINUTE
    duration_look = start + 60 * MINUTE
    rows: list[SeriesRow] = []
    short_flares = [(i, i + 5) for i in range(120, 480, 60)]
    for i in range(550):
        t = T0 + i * MINUTE
        slow = i >= 480 or any(lo <= i < hi for lo, hi in short_flares)
        rows.extend(
            [
                (
                    t,
                    "outbound_db",
                    "p95(span.duration)",
                    "42",
                    "prod",
                    "primary",
                    450.0 if slow else 30.0,
                ),
                (t, "outbound_db", "count_sample()", "42", "prod", "primary", 500.0),
            ]
        )

    evaluator = OrgEvaluator(NoFootprints())
    assert not evaluator.advance(rows=rows, hourly_rows=[], start=start, end=duration_look)
    (latent,) = evaluator.absorbed.values()
    assert latent.start == start and latent.sustained_at is not None

    (opened,) = evaluator.advance(
        rows=rows, hourly_rows=[], start=duration_look, end=duration_look + MINUTE
    )
    assert opened.timestamp == duration_look
    assert not opened.is_resolved
    assert not evaluator.absorbed


def test_new_failure_mode_opens_only_after_crossing_the_standalone_threshold() -> None:
    weak_at = T0 + 3 * MINUTE
    detected_at = T0 + 5 * MINUTE
    issue = ChangeEvent(
        SeriesKey("42", "prod", "new_issue", "count_unique(user)", "PRIVATE-42"),
        ChangeType.NEW_FAILURE_MODE,
        T0,
        actual=60.0,
        expected=60.0,
        confidence=0.9,
        detected_at=detected_at,
        evidence=["private failure payload", "issues:PRIVATE-42"],
    )
    weak = replace(issue, actual=10.0, confidence=0.5, detected_at=weak_at)
    evaluator = OrgEvaluator(NoFootprints())
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
        SeriesKey("42", "prod", "endpoints", "p95(span.duration)", "/private"),
        ChangeType.SLOWDOWN,
        T0,
        actual=700.0,
        expected=40.0,
        confidence=0.9,
    )
    other = ChangeEvent(
        SeriesKey("93", "staging", "errors", "count_unique(user)"),
        ChangeType.SPIKE,
        T0,
        actual=50.0,
        expected=1.0,
        confidence=0.9,
        evidence=["private cross-project details"],
    )
    group = AnomalyGroup(
        "stable-group", T0, [selected, other], blast_radius=["42/prod", "93/staging"]
    )
    evaluator = OrgEvaluator(NoFootprints())
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
                T0 + 3 * MINUTE, "close", group, root=other, merged_into="other-project-group"
            )
        ]
    )
    assert resolved == replace(updated, timestamp=T0 + 3 * MINUTE, is_resolved=True)
