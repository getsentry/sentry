from datetime import timedelta
from typing import List

from sentry import tsdb
from sentry.models import Group


def is_issue_error_rate_correlated(
    resolved_issue: Group, candidate_suspect_resolution: Group
) -> bool:
    if resolved_issue is None or candidate_suspect_resolution is None:
        return False

    resolution_time = resolved_issue.resolved_at

    # change to 5-6h?
    start_time = resolution_time - timedelta(hours=1)
    end_time = resolution_time + timedelta(hours=1)

    data = tsdb.get_range(
        model=tsdb.models.group,
        keys=[resolved_issue.id, candidate_suspect_resolution.id],
        rollup=60,
        start=start_time,
        end=end_time,
    )

    x = [events for _, events in data[resolved_issue.id]]
    y = [events for _, events in data[candidate_suspect_resolution.id]]

    return calculate_pearson_correlation_coefficient(x, y) > 0.4


def calculate_pearson_correlation_coefficient(x: List[int], y: List[int]) -> int:
    # source: https://inside-machinelearning.com/en/pearson-formula-in-python-linear-correlation-coefficient/

    # calculate average
    mean_x = sum(x) / len(x)
    mean_y = sum(y) / len(y)

    # calculate covariance
    cov = sum((a - mean_x) * (b - mean_y) for (a, b) in zip(x, y)) / len(x)

    # calculate standard deviation
    st_dev_x = (sum((a - mean_x) ** 2 for a in x) / len(x)) ** 0.5
    st_dev_y = (sum((b - mean_y) ** 2 for b in y) / len(y)) ** 0.5

    result = cov / (st_dev_x * st_dev_y)

    return result
