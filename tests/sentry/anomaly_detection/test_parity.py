from collections.abc import Sequence
from datetime import datetime, timedelta

from sentry.anomaly_detection.contracts import Metric, SeriesRow, Signal, Urgency
from sentry.anomaly_detection.evaluation import organization as pipeline
from tests.sentry.anomaly_detection.test_helpers import NoFootprints

START = datetime(2024, 1, 8, 12)  # Collector timestamps are naive UTC.
MINUTES = 200
PROJECT = 42
ENV = "production"
CHECKOUT = "/checkout"
REPORTS = "/reports"


def _at(minute: int) -> datetime:
    return START + timedelta(minutes=minute)


def _evaluate(rows: Sequence[SeriesRow]) -> Sequence[pipeline.AnomalyDecision]:
    return pipeline.evaluate_org(
        rows=rows,
        hourly_rows=[],
        start=START,
        end=_at(MINUTES),
        footprints=NoFootprints(),
        projects=(PROJECT,),
    )


def _endpoint_rows(
    *, endpoint: str = CHECKOUT, slow_minutes: range = range(0), slow_samples: float = 100.0
) -> list[SeriesRow]:
    return [
        SeriesRow(_at(i), Signal.ENDPOINTS, metric, PROJECT, ENV, endpoint, value)
        for i in range(MINUTES)
        for metric, value in (
            (Metric.COUNT, 200.0),
            (Metric.COUNT_SAMPLE, slow_samples if i in slow_minutes else 100.0),
            (Metric.P95_DURATION, 400.0 if i in slow_minutes else 100.0),
        )
    ]


def _traffic_rows(drop_minutes: set[int]) -> list[SeriesRow]:
    return [
        SeriesRow(_at(i), Signal.REQUESTS, metric, PROJECT, ENV, "", value)
        for i in range(MINUTES)
        for metric, value in (
            (Metric.COUNT, 250.0 if i in drop_minutes else 1000.0),
            (Metric.COUNT_SAMPLE, 125.0 if i in drop_minutes else 500.0),
        )
    ]


def _failure_rows(endpoint: str) -> list[SeriesRow]:
    return [
        SeriesRow(
            _at(i),
            Signal.ENDPOINTS,
            Metric.FAILURE_RATE,
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
    assert (activation.project_id, activation.env) == (PROJECT, ENV)
    assert (resolution.project_id, resolution.env) == (PROJECT, ENV)
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
    other_project = 43
    other_rows = [row._replace(project_id=other_project, env="staging") for row in rows]
    decisions = pipeline.evaluate_org(
        rows=rows + other_rows,
        hourly_rows=[],
        start=START,
        end=_at(MINUTES),
        footprints=NoFootprints(),
        projects=(other_project, PROJECT),
    )
    assert [(d.timestamp, d.is_resolved, d.urgency) for d in decisions] == [
        (_at(150), False, Urgency.MEDIUM),
        (_at(150), False, Urgency.MEDIUM),
        (_at(190), True, Urgency.MEDIUM),
        (_at(190), True, Urgency.MEDIUM),
    ]
    project_decisions = [d for d in decisions if d.project_id == PROJECT]
    assert project_decisions == list(_evaluate(rows))
    other_open, other_close = [d for d in decisions if d.project_id == other_project]
    assert other_open.group_key == other_close.group_key
    assert other_open.group_key != project_decisions[0].group_key
    assert other_open.env == other_close.env == "staging"
