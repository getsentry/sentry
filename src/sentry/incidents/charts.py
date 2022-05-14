from datetime import datetime, timedelta
from functools import reduce
from typing import Any, List, Mapping, Optional, cast

from django.utils import timezone

from sentry.api import client
from sentry.api.base import logger
from sentry.api.serializers import serialize
from sentry.api.serializers.models.alert_rule import AlertRuleSerializer
from sentry.api.serializers.models.incident import DetailedIncidentSerializer
from sentry.charts import generate_chart
from sentry.charts.types import ChartType
from sentry.incidents.logic import translate_aggregate_field
from sentry.incidents.models import AlertRule, Incident, User
from sentry.models import ApiKey, Organization
from sentry.snuba.dataset import Dataset

CRASH_FREE_SESSIONS = "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate"
CRASH_FREE_USERS = "percentage(users_crashed, users) AS _crash_rate_alert_aggregate"
SESSION_AGGREGATE_TO_FIELD = {
    CRASH_FREE_SESSIONS: "sum(session)",
    CRASH_FREE_USERS: "count_unique(user)",
}


API_INTERVAL_POINTS_LIMIT = 10000
API_INTERVAL_POINTS_MIN = 150


def incident_date_range(alert_rule: AlertRule, incident: Incident) -> Mapping[str, str]:
    """Retrieve the start/end for graphing an incident."""
    time_window_seconds = alert_rule.snuba_query.time_window
    min_range = time_window_seconds * API_INTERVAL_POINTS_MIN
    max_range = time_window_seconds * API_INTERVAL_POINTS_LIMIT
    now = timezone.now()
    start_date: datetime = incident.date_started
    end_date: datetime = incident.date_closed if incident.date_closed else now
    incident_range = max((end_date - start_date).total_seconds(), 3 * time_window_seconds)
    range = min(max_range, max(min_range, incident_range))
    half_range = timedelta(seconds=range / 2)

    return {
        "start": (start_date - half_range).strftime("%Y-%m-%dT%H:%M:%S"),
        "end": (end_date + half_range).strftime("%Y-%m-%dT%H:%M:%S"),
    }


def fetch_metric_alert_sessions_data(
    organization: Organization,
    alert_rule: AlertRule,
    time_period: Mapping[str, str],
    user: Optional["User"] = None,
) -> Any:
    aggregate = translate_aggregate_field(alert_rule.snuba_query.aggregate, reverse=True)
    project_id = alert_rule.snuba_query.subscriptions.select_related("project").first().project.id

    if "period" in time_period:
        time_period = {"statsPeriod": time_period["period"]}

    env = alert_rule.snuba_query.environment
    env_params = {"environment": env} if env else {}

    try:
        resp = client.get(
            auth=ApiKey(organization=organization, scope_list=["org:read"]),
            user=user,
            path=f"/organizations/{organization.slug}/sessions/",
            params={
                "field": SESSION_AGGREGATE_TO_FIELD[aggregate],
                "interval": f"{alert_rule.snuba_query.time_window}m",
                "project": str(project_id),
                "query": alert_rule.snuba_query.query,
                "groupBy": "session.status",
                **env_params,
                **time_period,
            },
        )
        return resp.data
    except Exception as exc:
        logger.error(
            f"Failed to load sessions for chart: {exc}",
            exc_info=True,
        )
        return None


def fetch_metric_alert_events_timeseries(
    organization: Organization,
    alert_rule: AlertRule,
    time_period: Mapping[str, str],
    user: Optional["User"] = None,
) -> List[Any]:
    env = alert_rule.snuba_query.environment
    env_params = {"environment": env} if env else {}
    aggregate = translate_aggregate_field(alert_rule.snuba_query.aggregate, reverse=True)
    project_id = alert_rule.snuba_query.subscriptions.select_related("project").first().project.id
    try:
        resp = client.get(
            auth=ApiKey(organization=organization, scope_list=["org:read"]),
            user=user,
            path=f"/organizations/{organization.slug}/events-stats/",
            params={
                "query": alert_rule.snuba_query.query,
                "interval": f"{alert_rule.snuba_query.time_window}m",
                "yAxis": aggregate,
                "project": str(project_id),
                **env_params,
                **time_period,
            },
        )
        # Format the data into a timeseries object for charts
        series = {
            "seriesName": aggregate,
            "data": [
                {
                    "name": point[0] * 1000,
                    "value": reduce(lambda a, b: a + float(b["count"]), point[1], 0.0),
                }
                for point in resp.data["data"]
            ],
        }
        return [series]
    except Exception as exc:
        logger.error(
            f"Failed to load events-stats for chart: {exc}",
            exc_info=True,
        )
        return []


def fetch_metric_alert_incidents(
    organization: Organization,
    alert_rule: AlertRule,
    time_period: Mapping[str, str],
    user: Optional["User"] = None,
) -> List[Any]:
    try:
        resp = client.get(
            auth=ApiKey(organization=organization, scope_list=["org:read"]),
            user=user,
            path=f"/organizations/{organization.slug}/incidents/",
            params={
                "alertRule": alert_rule.id,
                "expand": "activities",
                "includeSnapshots": True,
                "project": -1,
                **time_period,
            },
        )
        return cast(List[Any], resp.data)
    except Exception as exc:
        logger.error(
            f"Failed to load incidents for chart: {exc}",
            exc_info=True,
        )
        return []


def build_metric_alert_chart(
    organization: Organization,
    alert_rule: AlertRule,
    selected_incident: Optional[Incident] = None,
    period: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    user: Optional["User"] = None,
) -> Optional[str]:
    """Builds the dataset required for metric alert chart the same way the frontend would"""
    is_crash_free_alert = alert_rule.snuba_query.dataset in {
        Dataset.Sessions.value,
        Dataset.Metrics.value,
    }
    style = (
        ChartType.SLACK_METRIC_ALERT_SESSIONS
        if is_crash_free_alert
        else ChartType.SLACK_METRIC_ALERT_EVENTS
    )

    if selected_incident:
        time_period = incident_date_range(alert_rule, selected_incident)
    elif start and end:
        time_period = {"start": start, "end": end}
    elif period:
        time_period = {"period": period}
    else:
        time_period = {"period": "10000m"}

    chart_data = {
        "rule": serialize(alert_rule, user, AlertRuleSerializer()),
        "selectedIncident": serialize(selected_incident, user, DetailedIncidentSerializer()),
        "incidents": fetch_metric_alert_incidents(
            organization,
            alert_rule,
            time_period,
            user,
        ),
    }

    if is_crash_free_alert:
        chart_data["sessionResponse"] = fetch_metric_alert_sessions_data(
            organization,
            alert_rule,
            time_period,
            user,
        )
    else:
        chart_data["timeseriesData"] = fetch_metric_alert_events_timeseries(
            organization,
            alert_rule,
            time_period,
            user,
        )

    try:
        url = generate_chart(style, chart_data)
        return cast(str, url)
    except RuntimeError as exc:
        logger.error(
            f"Failed to generate chart for metric alert: {exc}",
            exc_info=True,
        )
        return None
