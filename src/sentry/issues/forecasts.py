"""
This module is for helper functions for escalating issues forecasts.
"""

from datetime import datetime
from typing import List

from sentry.issues.escalating import (
    ParsedGroupsCount,
    parse_groups_past_counts,
    query_groups_past_counts,
)
from sentry.issues.escalating_group_forecast import EscalatingGroupForecast
from sentry.issues.escalating_issues_alg import generate_issue_forecast
from sentry.models import Group


def save_forecast_per_group(
    until_escalating_groups: List[Group], group_counts: ParsedGroupsCount
) -> None:
    """
    Saves the list of forecasted values for each group in nodestore.

    `until_escalating_groups`: List of archived until escalating groups to be forecasted
    `group_counts`: Parsed snuba response of group counts
    """
    time = datetime.now()
    group_dict = {group.id: group for group in until_escalating_groups}
    for group_id in group_counts.keys():
        forecasts = generate_issue_forecast(group_counts[group_id], time)
        forecasts_list = [forecast["forecasted_value"] for forecast in forecasts]
        escalating_group_forecast = EscalatingGroupForecast(
            group_dict[group_id].project.id, group_id, forecasts_list, datetime.now()
        )
        escalating_group_forecast.save()


def generate_and_save_forecasts(groups: List[Group]) -> None:
    """
    Generates and saves a list of forecasted values for each group.
    `groups`: List of groups to be forecasted
    """
    past_counts = query_groups_past_counts(groups)
    group_counts = parse_groups_past_counts(past_counts)
    save_forecast_per_group(groups, group_counts)
