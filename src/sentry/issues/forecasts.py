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
from sentry.issues.escalating_issues_alg import generate_issue_forecast
from sentry.models import Group

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
        forecasts = generate_issue_forecast(group_count, time)
        forecasts_list = [forecast["forecasted_value"] for forecast in forecasts]

        if group_dict.get(group_id):
            escalating_group_forecast = EscalatingGroupForecast(
                group_dict[group_id].project.id, group_id, forecasts_list, time
            )
            escalating_group_forecast.save()
    logger.info(
        "Saved forecasts in nodestore",
        extra={"num_groups": len(group_counts.keys())},
    )
    analytics.record("issue_forecasts.saved", num_groups=len(group_counts.keys()))


def generate_and_save_forecasts(groups: Sequence[Group]) -> None:
    """
    Generates and saves a list of forecasted values for each group.
    `groups`: Sequence of groups to be forecasted
    """
    past_counts = query_groups_past_counts(groups)
    logger.info(
        "Queried groups from snuba",
        extra={"num_groups": len(past_counts)},
    )
    group_counts = parse_groups_past_counts(past_counts)
    save_forecast_per_group(groups, group_counts)
