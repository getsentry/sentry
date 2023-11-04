from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import List, Optional, Sequence

from sentry import tsdb
from sentry.models.group import Group
from sentry.tsdb.base import TSDBModel


@dataclass
class CandidateMetricCorrResult:
    candidate_suspect_resolution_id: int
    is_correlated: bool
    coefficient: float
    candidate_issue_total_events: int
    resolved_issue_total_events: int


@dataclass
class IssueReleaseMetricCorrResult:
    candidate_metric_correlations: Sequence[CandidateMetricCorrResult]
    issue_resolved_time: datetime
    correlation_start_time: datetime
    correlation_end_time: datetime


def is_issue_error_rate_correlated(
    resolved_issue: Group, candidate_suspect_resolutions: List[Group]
) -> Optional[IssueReleaseMetricCorrResult]:
    if (
        not resolved_issue
        or not resolved_issue.resolved_at
        or len(candidate_suspect_resolutions) == 0
    ):
        return None

    resolution_time = resolved_issue.resolved_at

    start_time = resolution_time - timedelta(hours=5)
    end_time = resolution_time + timedelta(hours=1)

    data = tsdb.backend.get_range(
        model=TSDBModel.group,
        keys=[resolved_issue.id] + [csr.id for csr in candidate_suspect_resolutions],
        rollup=600,
        start=start_time,
        end=end_time,
        tenant_ids={"organization_id": resolved_issue.project.organization_id},
    )

    x = [events for _, events in data[resolved_issue.id]]
    y = {csr.id: [events for _, events in data[csr.id]] for csr in candidate_suspect_resolutions}

    resolved_issue_total_events = sum(x)
    candidate_issue_total_events = {csr: sum(events) for csr, events in y.items()}

    coefficients = {csr_id: calculate_pearson_correlation_coefficient(x, y[csr_id]) for csr_id in y}

    results = [
        CandidateMetricCorrResult(
            candidate_suspect_resolution_id=csr_id,
            is_correlated=coefficient > 0.4,
            coefficient=coefficient,
            candidate_issue_total_events=candidate_issue_total_events[csr_id],
            resolved_issue_total_events=resolved_issue_total_events,
        )
        for (csr_id, coefficient) in coefficients.items()
    ]

    return IssueReleaseMetricCorrResult(results, resolution_time, start_time, end_time)


def calculate_pearson_correlation_coefficient(x: Sequence[int], y: Sequence[int]) -> float:
    # source: https://inside-machinelearning.com/en/pearson-formula-in-python-linear-correlation-coefficient/
    if len(x) == 0 or len(y) == 0:
        return 0.0

    mean_x = sum(x) / len(x)
    mean_y = sum(y) / len(y)

    cov = sum((a - mean_x) * (b - mean_y) for (a, b) in zip(x, y)) / len(x)

    st_dev_x = (sum((a - mean_x) ** 2 for a in x) / len(x)) ** 0.5
    st_dev_y = (sum((b - mean_y) ** 2 for b in y) / len(y)) ** 0.5

    st_dev_x_y = st_dev_x * st_dev_y

    if st_dev_x_y == 0 or st_dev_x_y == 0.0:
        return 0.0

    return float(cov / st_dev_x_y)
