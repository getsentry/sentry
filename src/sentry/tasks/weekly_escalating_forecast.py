from datetime import datetime
from typing import Any, Dict, List

from django.db import transaction

from sentry.models import Group, GroupStatus
from sentry.models.groupforecast import GroupForecast
from sentry.models.groupsnooze import GroupSnooze
from sentry.tasks.base import instrumented_task
from sentry.tasks.escalating_issues_alg import issue_spike
from sentry.utils.json import JSONData

BATCH_SIZE = 200


def query_groups_past_counts(groups: List[Group]) -> JSONData:
    return {}


@instrumented_task(
    name="sentry.tasks.weekly_escalating_forecast.run_escalating_forecast",
    queue="weekly_escalating_forecast",
    max_retries=5,
)  # type: ignore
def run_escalating_forecast() -> None:
    until_escalating_groups = [gs.group for gs in GroupSnooze.objects.filter(until_escalating=True)]
    ignored_groups_ids = [
        group["id"] for group in Group.objects.filter(status=GroupStatus.IGNORED).values()
    ]
    archived_groups = [group for group in until_escalating_groups if group.id in ignored_groups_ids]
    if not archived_groups:
        return
    archived_groups.sort(key=lambda x: int(x.id), reverse=True)
    response = query_groups_past_counts(archived_groups)

    # Flatten data into lists to be used in issue_spike
    data_index = 0
    time = datetime.now()
    group_forecast_list = []
    for group in archived_groups:
        group_data: Dict[str, List[Any]] = {"intervals": [], "data": []}
        while (
            data_index < len(response["data"])
            and group.id == response["data"][data_index]["group_id"]
        ):
            group_data["intervals"].append(response["data"][data_index]["hourBucket"])
            group_data["data"].append(response["data"][data_index]["count()"])
            data_index += 1

        forecasts = issue_spike(group_data, time)
        forecasts_list = [forecast["forecasted_value"] for forecast in forecasts]
        group_forecast_list.append((group, forecasts_list))

    with transaction.atomic():
        # Delete old forecasts
        GroupForecast.objects.filter(group__in=archived_groups).delete()

        # Bulk create new forecasts
        GroupForecast.objects.bulk_create(
            [
                GroupForecast(group=group, forecast=forecast)
                for group, forecast in group_forecast_list
            ],
            batch_size=BATCH_SIZE,  # Is this a good batch size?
        )
