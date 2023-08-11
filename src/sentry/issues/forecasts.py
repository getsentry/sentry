"""
This module is for helper functions for escalating issues forecasts.
"""

import logging
from datetime import datetime
from typing import Sequence

from sentry import analytics
from sentry.issues.escalating import (
    ParsedGroupsCount,
    parse_groups_past_counts,
    query_groups_past_counts,
)
from sentry.issues.escalating_group_forecast import EscalatingGroupForecast
from sentry.issues.escalating_issues_alg import generate_issue_forecast, standard_version
from sentry.models import Group
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.utils.cache import cache

logger = logging.getLogger(__name__)


def save_forecast_per_group(
    until_escalating_groups: Sequence[Group], group_counts: ParsedGroupsCount
) -> None:
    """
    Saves the list of forecasted values for each group in nodestore.

    `until_escalating_groups`: Sequence of archived until escalating groups to be forecasted
    `group_counts`: Parsed snuba response of group counts
    """
    time = datetime.now()
    group_dict = {group.id: group for group in until_escalating_groups}
    for group_id, group_count in group_counts.items():
        group = group_dict.get(group_id)
        if group:
            forecasts = generate_issue_forecast(group_count, time, standard_version)
            forecasts_list = [forecast["forecasted_value"] for forecast in forecasts]

            escalating_group_forecast = EscalatingGroupForecast(
                group.project.id, group_id, forecasts_list, time
            )
            escalating_group_forecast.save()

    analytics.record("issue_forecasts.saved", num_groups=len(group_counts.keys()))


def generate_and_save_forecasts(groups: Sequence[Group]) -> None:
    """
    Generates and saves a list of forecasted values for each group.
    `groups`: Sequence of groups to be forecasted
    """

    # Check if any of the groups are source groups involved in an unmerge in the last 24 hrs
    # If a group was a source group in an unmerge in the last 24 hr, then we must query all the
    # groups involved in the unmerge to get accurate event counts due to a Clickhouse bug.
    if groups:
        project_id = groups[0].project.id
        source_key = f"source-groups:{project_id}"
        source_ids = cache.get(source_key)
        if source_ids:
            source_groups_ids = [id for id in groups if id in source_ids]
            for source_id in source_groups_ids:
                unmerge_key = f"unmerged-groups:{project_id}:{source_id}"
                unmerge_groups_ids = cache.get(unmerge_key)
                unmerge_groups = Group.objects.filter(
                    project=groups[0].project, id__in=unmerge_groups_ids
                )
                groups = groups + unmerge_groups

    past_counts = query_groups_past_counts(groups)
    group_counts = parse_groups_past_counts(past_counts)
    save_forecast_per_group(groups, group_counts)
    logger.info(
        "generate_and_save_forecasts",
        extra={
            "detail": "Created forecast for groups",
            "group_ids": [group.id for group in groups],
        },
    )


@instrumented_task(
    name="sentry.tasks.weekly_escalating_forecast.generate_and_save_missing_forecasts",
    queue="weekly_escalating_forecast",
    silo_mode=SiloMode.REGION,
)
def generate_and_save_missing_forecasts(group_id: int) -> None:
    """
    Runs generate_and_save_forecasts in a task if the forecast does not exist.
    This will happen if the forecast in nodestore TTL expired and the issue has not been seen in
    7 days.
    """
    group = Group.objects.filter(id=group_id)
    generate_and_save_forecasts(group)
