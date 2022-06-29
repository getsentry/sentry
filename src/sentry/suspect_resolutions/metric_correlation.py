from datetime import timedelta

import scipy.stats

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

    resolved_issue_events = [events for _, events in data[resolved_issue_id]]

    issue2_events = [events for _, events in data[issue2_id]]

    (r, p) = scipy.stats.pearsonr(resolved_issue_events, issue2_events)

    return r > 0.4 and p < 0.4
