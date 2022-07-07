from datetime import timedelta

from sentry import tsdb
from sentry.models import Group


def is_issue_error_rate_correlated(resolved_issue_id: int, issue2_id: int) -> bool:
    resolved_issue = Group.objects.filter(id=resolved_issue_id)

    if len(resolved_issue) != 1:
        return False

    resolution_time = resolved_issue.values_list("resolved_at", flat=True)[0]

    start_time = resolution_time - timedelta(hours=1)
    end_time = resolution_time + timedelta(hours=1)

    data = tsdb.get_range(
        model=tsdb.models.group,
        keys=[resolved_issue_id, issue2_id],
        rollup=60,
        start=start_time,
        end=end_time,
    )

    x = [events for _, events in data[resolved_issue_id]]

    y = [events for _, events in data[issue2_id]]

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

    return result > 0.4
