from dataclasses import dataclass
from datetime import timedelta
from typing import List

from sentry import tsdb
from sentry.models import Group


@dataclass
class MetricCorrelationResult:
    candidate_suspect_resolution_id: int
    is_correlated: bool
    coefficient: float


def is_issue_error_rate_correlated(
    resolved_issue: Group, candidate_suspect_resolutions: List[Group]
) -> List[MetricCorrelationResult]:
    if resolved_issue is None or len(candidate_suspect_resolutions) == 0:
        return []

    resolution_time = resolved_issue.resolved_at

    start_time = resolution_time - timedelta(hours=5)
    end_time = resolution_time + timedelta(hours=1)

    data = tsdb.get_range(
        model=tsdb.models.group,
        keys=[resolved_issue.id] + [csr.id for csr in candidate_suspect_resolutions],
        rollup=60,
        start=start_time,
        end=end_time,
    )

    x = [events for _, events in data[resolved_issue.id]]
    y = {csr.id: [events for _, events in data[csr.id]] for csr in candidate_suspect_resolutions}

    coefficients = {csr_id: calculate_pearson_correlation_coefficient(x, y[csr_id]) for csr_id in y}

    results = [
        MetricCorrelationResult(
            candidate_suspect_resolution_id=csr_id,
            is_correlated=coefficient > 0.4,
            coefficient=coefficient,
        )
        for (csr_id, coefficient) in coefficients.items()
    ]

    return (results, resolution_time, start_time, end_time)


def calculate_pearson_correlation_coefficient(x: List[int], y: List[int]) -> int:
    # source: https://inside-machinelearning.com/en/pearson-formula-in-python-linear-correlation-coefficient/
    if len(x) and len(y) == 0:
        return 0

    mean_x = sum(x) / len(x)
    mean_y = sum(y) / len(y)

    cov = sum((a - mean_x) * (b - mean_y) for (a, b) in zip(x, y)) / len(x)

    st_dev_x = (sum((a - mean_x) ** 2 for a in x) / len(x)) ** 0.5
    st_dev_y = (sum((b - mean_y) ** 2 for b in y) / len(y)) ** 0.5

    result = cov / (st_dev_x * st_dev_y)

    return result
