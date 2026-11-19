from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest
from snuba_sdk import Column, Condition, Op, Query

from sentry.anomaly_detection.checkpoint.replay import advance_org
from sentry.anomaly_detection.contracts import ChangeEvent, Urgency
from sentry.anomaly_detection.detector_handler import AnomalyDetectionDetectorHandler
from sentry.anomaly_detection.evaluation import organization as pipeline
from sentry.anomaly_detection.evaluation.series import SeriesRow
from sentry.anomaly_detection.grouptype import AnomalyDetection
from sentry.anomaly_detection.inputs import new_failures
from sentry.anomaly_detection.inputs.measurements import ERROR_USER
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.events.types import SnubaRow
from sentry.workflow_engine.models import Detector

START = datetime(2024, 1, 8, 12)  # Collector timestamps are naive UTC.
MINUTES = 200
PROJECT = "42"
ENV = "production"
CHECKOUT = "/checkout"
REPORTS = "/reports"


def make_handlers(*projects: str) -> dict[str, AnomalyDetectionDetectorHandler]:
    return {
        project: AnomalyDetectionDetectorHandler(
            Detector(id=int(project), project_id=int(project), type=AnomalyDetection.slug)
        )
        for project in projects
    }


class NoFootprints:
    def footprint(self, event: ChangeEvent, observation_end: datetime) -> None:
        return None


def _at(minute: int) -> datetime:
    return START + timedelta(minutes=minute)


def _evaluate(rows: Sequence[SeriesRow]) -> Sequence[pipeline.AnomalyDecision]:
    return pipeline.evaluate_org(
        rows=rows,
        hourly_rows=[],
        start=START,
        end=_at(MINUTES),
        footprints=NoFootprints(),
        handlers=make_handlers(PROJECT),
    )


def _endpoint_rows(
    *, endpoint: str = CHECKOUT, slow_minutes: range = range(0), slow_samples: float = 100.0
) -> list[SeriesRow]:
    return [
        (_at(i), "endpoints", metric, PROJECT, ENV, endpoint, value)
        for i in range(MINUTES)
        for metric, value in (
            ("count()", 200.0),
            ("count_sample()", slow_samples if i in slow_minutes else 100.0),
            ("p95(span.duration)", 400.0 if i in slow_minutes else 100.0),
        )
    ]


def _traffic_rows(drop_minutes: set[int]) -> list[SeriesRow]:
    return [
        (_at(i), "requests", metric, PROJECT, ENV, "", value)
        for i in range(MINUTES)
        for metric, value in (
            ("count()", 250.0 if i in drop_minutes else 1000.0),
            ("count_sample()", 125.0 if i in drop_minutes else 500.0),
        )
    ]


def _failure_rows(endpoint: str) -> list[SeriesRow]:
    return [
        (
            _at(i),
            "endpoints",
            "failure_rate()",
            PROJECT,
            ENV,
            endpoint,
            0.09 if 124 <= i < 138 else 0.03,
        )
        for i in range(MINUTES)
    ]


def _assert_transitions(
    decisions: Sequence[pipeline.AnomalyDecision], *, opened: int, closed: int, urgency: Urgency
) -> None:
    assert [(d.timestamp, d.is_resolved, d.urgency) for d in decisions] == [
        (_at(opened), False, urgency),
        (_at(closed), True, urgency),
    ]
    activation, resolution = decisions
    assert (activation.project_id, activation.env) == (int(PROJECT), ENV)
    assert (resolution.project_id, resolution.env) == (int(PROJECT), ENV)
    assert activation.group_key == resolution.group_key
    # The slower endpoint is the root in these fixtures. The resolution retains
    # evidence of the excursion, not the normal measurements at resolution time.
    assert (
        activation.evidence
        == resolution.evidence
        == {
            "signal": "endpoints",
            "change_type": "slowdown",
            "started_at": _at(120).isoformat(),
            "actual": 400.0,
            "expected": 100.0,
            "confidence": 0.99,
        }
    )


def test_traffic_drop_needs_eight_flagged_minutes_in_the_last_ten() -> None:
    # A short slowdown alone is low urgency and hidden. The traffic drop is what makes
    # the group visible, so the issue activation pins when the 8-of-10 rule opens.
    slowdown = _endpoint_rows(slow_minutes=range(120, 136))
    seven = {120, 121, 122, 124, 125, 127, 128}
    assert not _evaluate(slowdown + _traffic_rows(seven | {130}))

    decisions = _evaluate(slowdown + _traffic_rows(seven | {129}))
    # Drop recovers at 139 (10 normal minutes). Slowdown recovers at 155 (20 normal
    # minutes at the evidence cap). Correlation closes 15 quiet minutes after the last recovery.
    _assert_transitions(decisions, opened=129, closed=170, urgency=Urgency.LOW)


def test_single_sample_per_minute_does_not_create_a_slowdown() -> None:
    # Keep the reported p95 and extrapolated volume fixed while changing the sample count.
    slow_minutes = range(120, 156)
    thin = _endpoint_rows(slow_minutes=slow_minutes, slow_samples=1.0)
    assert not _evaluate(thin)
    # The drop would corroborate any incorrectly opened p95 change, even one that
    # never reaches the sustained-slowdown promotion threshold on its own.
    assert not _evaluate(thin + _traffic_rows(set(range(120, 128))))

    decisions = _evaluate(_endpoint_rows(slow_minutes=slow_minutes))
    # A lone 4x slowdown is first visible after 30 minutes, not at its 3-of-5 detection.
    _assert_transitions(decisions, opened=150, closed=190, urgency=Urgency.MEDIUM)


def test_two_metrics_on_one_endpoint_are_not_independent_evidence() -> None:
    endpoints = _endpoint_rows(slow_minutes=range(120, 132)) + _endpoint_rows(endpoint=REPORTS)
    # A six-point rise is detectable but too small for a medium-urgency failure spike.
    # The slowdown is also too short for sustained promotion.
    assert not _evaluate(endpoints + _failure_rows(CHECKOUT))

    # Different endpoints with nearby onsets join by timing, but count independently.
    decisions = _evaluate(endpoints + _failure_rows(REPORTS))
    # Slowdown recovers at 150 and the failure rate at 157; quiet starts at the latter.
    _assert_transitions(decisions, opened=126, closed=172, urgency=Urgency.LOW)


def test_registered_projects_keep_independent_slowdown_lifecycles() -> None:
    rows = _endpoint_rows(slow_minutes=range(120, 156))
    other_project = "43"
    other_rows = [
        (ts, signal, metric, other_project, "staging", dim, value)
        for ts, signal, metric, _, _, dim, value in rows
    ]
    decisions = pipeline.evaluate_org(
        rows=rows + other_rows,
        hourly_rows=[],
        start=START,
        end=_at(MINUTES),
        footprints=NoFootprints(),
        handlers=make_handlers(other_project, PROJECT),
    )
    assert [(d.timestamp, d.is_resolved, d.urgency) for d in decisions] == [
        (_at(150), False, Urgency.MEDIUM),
        (_at(150), False, Urgency.MEDIUM),
        (_at(190), True, Urgency.MEDIUM),
        (_at(190), True, Urgency.MEDIUM),
    ]
    project_decisions = [d for d in decisions if d.project_id == int(PROJECT)]
    assert project_decisions == list(_evaluate(rows))
    other_open, other_close = [d for d in decisions if d.project_id == int(other_project)]
    assert other_open.group_key == other_close.group_key
    assert other_open.group_key != project_decisions[0].group_key
    assert other_open.env == other_close.env == "staging"


@pytest.mark.parametrize(
    ("prior_hour", "closing_hour", "new_users", "expected", "page_offsets"),
    [
        pytest.param(
            300.0,
            900.0,
            [(56, 14), (57, 1), (59, 15), (60, 1)],
            [(57, 10, 15.0, 0.5), (58, 15, 15.0, 0.9)],
            [0],
            id="preserve-earlier-crossing-on-rise",
        ),
        pytest.param(
            300.0,
            900.0,
            [(56, 10), (59, 5), (60, 15)],
            [(57, 10, 15.0, 0.5), (61, 30, 30.0, 0.9)],
            [0],
            id="use-new-threshold-in-boundary-observation",
        ),
        pytest.param(
            24_000.0,
            620.0,
            [(56, 620)],
            [(57, 10, 1200.0, 0.5), (60, 620, 615.5, 0.9)],
            [0, 500],
            id="promote-existing-audience-on-fall",
        ),
    ],
)
def test_new_failure_thresholds_match_live_and_catchup_across_hour_close(
    prior_hour: float,
    closing_hour: float,
    new_users: list[tuple[int, int]],
    expected: list[tuple[int, int, float, float]],
    page_offsets: list[int],
) -> None:
    organization = Organization(id=1)
    project = Project(id=int(PROJECT), organization=organization)
    group = Group(id=1, project=project, first_seen=_at(56).replace(tzinfo=UTC), message="failure")
    # These timestamps represent the first occurrence of each distinct user.
    first_users = [_at(minute) for minute, count in new_users for _ in range(count)]
    minute_rows: list[SeriesRow] = [
        (_at(minute), "errors", "count()", PROJECT, ENV, "", float(count))
        for minute, count in new_users
    ]
    hourly_rows: list[SeriesRow] = [
        (hour, "errors", "count_unique(user)", PROJECT, ENV, "", users)
        for hour, users in (
            (START - timedelta(days=16), 60_000.0),
            (_at(-60), prior_hour),
            (START, closing_hour),
        )
    ]

    offsets: list[int] = []

    def error_rows(_organization: Organization, query: Query, _referrer: str) -> list[SnubaRow]:
        bounds = {
            condition.op: condition.rhs.replace(tzinfo=None)
            for condition in query.where or ()
            if isinstance(condition, Condition)
            and condition.lhs == Column("timestamp")
            and isinstance(condition.rhs, datetime)
        }
        times = [ts for ts in first_users if bounds[Op.GTE] <= ts < bounds[Op.LT]]
        if query.groupby == [Column("group_id")]:
            if not times:
                return []
            return [{"group_id": group.id, "users": len(times), "count()": len(times)}]
        assert query.groupby == [Column(ERROR_USER)]
        assert query.limit is not None
        offset = query.offset.offset if query.offset else 0
        offsets.append(offset)
        return [{"first_seen": ts} for ts in times[offset : offset + query.limit.limit]]

    def run(boundaries: Sequence[int]) -> tuple[list[ChangeEvent], list[pipeline.AnomalyDecision]]:
        issues: list[ChangeEvent] = []
        decisions: list[pipeline.AnomalyDecision] = []
        checkpoint = None
        for left, right in zip(boundaries[:-1], boundaries[1:], strict=True):
            start, end = _at(left), _at(right)
            # Match scheduler refresh: at :00 it gains the newly closed bucket
            # and drops the oldest bucket of its 16-day history.
            hour = end.replace(minute=0)
            hourly = [row for row in hourly_rows if hour - timedelta(days=16) <= row[0] < hour]
            rows = [row for row in minute_rows if start <= row[0] < end]
            new_issues = new_failures.collect_new_failure_modes(
                organization,
                [project],
                new_failures.new_failure_thresholds(hourly),
                start,
                end,
                current_rows=rows,
            )
            issues.extend(new_issues)
            batch, checkpoint = advance_org(
                rows=rows,
                hourly_rows=hourly,
                start=start,
                end=end,
                new_issues=new_issues,
                checkpoint=checkpoint,
                footprints=NoFootprints(),
                handlers=make_handlers(PROJECT),
            )
            decisions.extend(batch)
        return issues, decisions

    with (
        patch.object(new_failures, "_recent_error_groups", lambda *_: {group.id: group}),
        patch.object(new_failures, "_ISSUE_USER_PAGE_SIZE", 500),
        patch.object(new_failures, "_run_errors", error_rows),
    ):
        live = run(range(55, 64))
        assert run((55, 60, 63)) == live
        offsets.clear()
        assert run((55, 63)) == live
    assert offsets == page_offsets
    issues, decisions = live
    assert [(e.detected_at, e.actual, e.expected, e.confidence) for e in issues] == [
        (_at(minute), users, threshold, confidence)
        for minute, users, threshold, confidence in expected
    ]
    (opened,) = decisions
    assert not opened.is_resolved
    assert opened.timestamp == _at(expected[-1][0])
