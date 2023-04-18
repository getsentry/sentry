import logging
from datetime import datetime
from typing import Dict, List, TypedDict

from sentry_sdk.crons.decorator import monitor

from sentry.issues.escalating import GroupsCountResponse, query_groups_past_counts
from sentry.issues.escalating_group_forecast import EscalatingGroupForecast
from sentry.issues.escalating_issues_alg import generate_issue_forecast
from sentry.models import Group, GroupStatus
from sentry.models.group import GroupSubStatus
from sentry.tasks.base import instrumented_task


class GroupCount(TypedDict):
    intervals: List[str]
    data: List[int]


ParsedGroupsCount = Dict[int, GroupCount]

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.weekly_escalating_forecast.run_escalating_forecast",
    queue="weekly_escalating_forecast",
    max_retries=0,  # TODO: Increase this when the task is changed to run weekly
)  # type: ignore
@monitor(monitor_slug="escalating-issue-forecast-job-monitor")
def run_escalating_forecast() -> None:
    """
    Run the escalating forecast algorithm on archived until escalating issues.
    """
    logger.info("Starting task for sentry.tasks.weekly_escalating_forecast.run_escalating_forecast")
    # TODO: Do not limit to project id = 1 and limit 10 once these topics are clarified
    # TODO: If possible, fetch group_id instead of the entire group model
    until_escalating_groups = list(
        Group.objects.filter(
            status=GroupStatus.IGNORED,
            substatus=GroupSubStatus.UNTIL_ESCALATING,
            project__id=1,
        )[:10]
    )
    logger.info(
        "Checking for archived until escalating groups",
        extra={"has_groups": len(until_escalating_groups) > 0},
    )
    if not until_escalating_groups:
        return

    get_forecasts(until_escalating_groups)


def parse_groups_past_counts(response: List[GroupsCountResponse]) -> ParsedGroupsCount:
    """
    Return the parsed snuba response for groups past counts to be used in generate_issue_forecast.
    ParsedGroupCount is of the form {<group_id>: {"intervals": [str], "data": [int]}}.

    `response`: Snuba response for group event counts
    """
    group_counts: ParsedGroupsCount = {}
    group_ids_list = group_counts.keys()
    for data in response:
        group_id = data["group_id"]
        if group_id not in group_ids_list:
            group_counts[group_id] = {
                "intervals": [data["hourBucket"]],
                "data": [data["count()"]],
            }
        else:
            group_counts[group_id]["intervals"].append(data["hourBucket"])
            group_counts[group_id]["data"].append(data["count()"])
    return group_counts


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


def get_forecasts(groups: List[Group]) -> None:
    """
    Returns a list of forecasted values for each group.
    `groups`: List of groups to be forecasted
    """
    past_counts = query_groups_past_counts(groups)
    group_counts = parse_groups_past_counts(past_counts)
    save_forecast_per_group(groups, group_counts)
