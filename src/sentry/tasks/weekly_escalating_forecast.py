from datetime import datetime
from typing import Dict, List, Tuple, Union

from django.db import transaction

from sentry.issues.escalating import query_groups_past_counts
from sentry.issues.escalating_issues_alg import generate_issue_forecast
from sentry.models import Group, GroupStatus
from sentry.models.groupforecast import GroupForecast
from sentry.tasks.base import instrumented_task
from sentry.utils.json import JSONData

BATCH_SIZE = 1000
GroupForecastTuple = Tuple[Group, List[int]]
ParsedGroupCount = Dict[int, Dict[str, List[Union[str, int]]]]


@instrumented_task(
    name="sentry.tasks.weekly_escalating_forecast.run_escalating_forecast",
    queue="weekly_escalating_forecast",
    max_retries=5,
)  # type: ignore
def run_escalating_forecast() -> None:
    archived_groups = list(
        Group.objects.filter(groupsnooze__until_escalating=True, status=GroupStatus.IGNORED)
    )
    if not archived_groups:
        return

    response = query_groups_past_counts(archived_groups)
    group_counts = parse_groups_past_counts(response)
    group_forecast_list = get_forecast_per_group(archived_groups, group_counts)

    with transaction.atomic():
        # Delete old forecasts
        GroupForecast.objects.filter(group__in=archived_groups).delete()

        # Bulk create new forecasts
        GroupForecast.objects.bulk_create(
            [
                GroupForecast(group=group, forecast=forecast)
                for group, forecast in group_forecast_list
            ],
            batch_size=BATCH_SIZE,
        )


def parse_groups_past_counts(response: JSONData) -> ParsedGroupCount:
    """
    Return the parsed snuba response for groups past counts to be used in generate_issue_forecast.
    ParsedGroupCount is of the form {<group_id>: {"intervals": [str], "data": [int]}}.

    `response`: Snuba response for group event counts
    """
    group_counts: ParsedGroupCount = {}
    for data in response:
        group_id = data["group_id"]
        if group_id not in group_counts.keys():
            group_counts[group_id] = {
                "intervals": [data["hourBucket"]],
                "data": [data["count()"]],
            }
        else:
            group_counts[group_id]["intervals"].append(data["hourBucket"])
            group_counts[group_id]["data"].append(data["count()"])
    return group_counts


def get_forecast_per_group(
    archived_groups: List[Group], group_counts: ParsedGroupCount
) -> List[GroupForecastTuple]:
    """
    Returns a list of forecasted values for each group.

    `archived_groups`: List of archived groups to be forecasted
    `group_counts`: Parsed snuba response of group counts
    """
    time = datetime.now()
    group_forecast_list: List[GroupForecastTuple] = []
    group_dict = {group.id: group for group in archived_groups}
    for group_id in group_counts.keys():
        forecasts = generate_issue_forecast(group_counts[group_id], time)
        forecasts_list = [int(forecast["forecasted_value"]) for forecast in forecasts]
        group_forecast_list.append((group_dict[group_id], forecasts_list))
    return group_forecast_list
