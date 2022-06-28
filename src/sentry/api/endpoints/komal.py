from datetime import timedelta

import scipy.stats

from sentry import tsdb
from sentry.models import GroupLink


def is_issue_error_rate_correlated(resolved_issue_id: int, issue2: int) -> bool:
    # pearson r, or cross-correlation, or heuristic approach
    # query snuba to gather the metric data for the active release time-window
    # apply the correlation method
    # return whether they're correlated

    resolution_time = GroupLink.objects.filter(group_id=resolved_issue_id).values_list(
        "datetime", flat=True
    )

    start_time = resolution_time[0] - timedelta(hours=1)
    end_time = resolution_time[0] + timedelta(hours=1)

    data = tsdb.get_range(
        model=tsdb.models.group,
        keys=[resolved_issue_id, issue2],
        rollup=60,
        start=start_time,
        end=end_time,
    )

    resolved_issue_events = []
    issue2_events = []
    #
    # print(data[resolved_issue_id])
    # print(data[issue2])

    for i in data[resolved_issue_id]:
        resolved_issue_events.append(i[1])

    for i in data[issue2]:
        issue2_events.append(i[1])

    (r, p) = scipy.stats.pearsonr(resolved_issue_events, issue2_events)

    # print(r, p)

    if r > 0.4 and p < 0.4:
        return True
    return False


if __name__ == "__main__":
    is_issue_error_rate_correlated(2, 1, 49)
