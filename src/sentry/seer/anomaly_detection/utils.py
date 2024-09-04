from datetime import datetime
from typing import Any

from django.utils.datastructures import MultiValueDict

from sentry import release_health
from sentry.incidents.models.alert_rule import AlertRuleThresholdType
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.anomaly_detection.types import TimeSeriesPoint
from sentry.snuba import metrics_performance
from sentry.snuba.sessions_v2 import QueryDefinition
from sentry.utils.snuba import SnubaTSResult


def translate_direction(direction: int) -> str:
    """
    Temporary translation map to Seer's expected values
    """
    direction_map = {
        AlertRuleThresholdType.ABOVE: "up",
        AlertRuleThresholdType.BELOW: "down",
        AlertRuleThresholdType.ABOVE_AND_BELOW: "both",
    }
    return direction_map[AlertRuleThresholdType(direction)]


NUM_DAYS = 28


def get_crash_free_historical_data(
    start: datetime, end: datetime, project: Project, organization: Organization, granularity: int
):
    """
    Fetch the historical metrics data from Snuba for crash free user rate and crash free session rate metrics
    """

    params = {
        "start": start,
        "end": end,
        "project_id": [project.id],
        "project_objects": [project],
        "organization_id": organization.id,
    }
    query_params: MultiValueDict[str, Any] = MultiValueDict(
        {
            "project": [project.id],
            "statsPeriod": [f"{NUM_DAYS}d"],
            "field": ["sum(session)"],
            "groupBy": ["release"],
        }
    )
    query = QueryDefinition(
        query=query_params,
        params=params,
        offset=None,
        limit=None,
        query_config=release_health.backend.sessions_query_config(organization),
    )
    result = release_health.backend.run_sessions_query(
        organization.id, query, span_op="sessions.anomaly_detection"
    )
    return SnubaTSResult(
        {
            "data": result,
        },
        result.get("start"),
        result.get("end"),
        granularity,
    )


def format_historical_data(data: SnubaTSResult, dataset: Any) -> list[TimeSeriesPoint]:
    """
    Format Snuba data into the format the Seer API expects.
    For errors data:
        If there are no results, it's just the timestamp
        {'time': 1719012000}, {'time': 1719018000}, {'time': 1719024000}

        If there are results, the count is added
        {'time': 1721300400, 'count': 2}

    For metrics_performance dataset/sessions data:
        The count is stored separately from the timestamps, if there is no data the count is 0
    """
    formatted_data: list[TimeSeriesPoint] = []
    nested_data = data.data.get("data", [])

    if dataset == metrics_performance:
        groups = nested_data.get("groups")
        if not len(groups):
            return formatted_data
        series = groups[0].get("series")

        for time, count in zip(nested_data.get("intervals"), series.get("sum(session)")):
            date = datetime.strptime(time, "%Y-%m-%dT%H:%M:%SZ")
            ts_point = TimeSeriesPoint(timestamp=date.timestamp(), value=count)
            formatted_data.append(ts_point)
    else:
        for datum in nested_data:
            ts_point = TimeSeriesPoint(timestamp=datum.get("time"), value=datum.get("count", 0))
            formatted_data.append(ts_point)
    return formatted_data
