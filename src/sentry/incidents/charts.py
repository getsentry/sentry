from datetime import datetime, timedelta
from functools import reduce
from typing import Any, List, Mapping, Optional

from django.utils import timezone

from sentry import features
from sentry.api import client
from sentry.api.base import logger
from sentry.api.serializers import serialize
from sentry.api.serializers.models.alert_rule import AlertRuleSerializer
from sentry.api.serializers.models.incident import DetailedIncidentSerializer
from sentry.api.utils import get_datetime_from_stats_period
from sentry.charts import backend as charts
from sentry.charts.types import ChartSize, ChartType
from sentry.incidents.logic import translate_aggregate_field
from sentry.incidents.models import AlertRule, Incident
from sentry.models.apikey import ApiKey
from sentry.models.organization import Organization
from sentry.models.user import User
from sentry.snuba.dataset import Dataset
from sentry.snuba.entity_subscription import apply_dataset_query_conditions
from sentry.snuba.models import SnubaQuery

CRASH_FREE_SESSIONS = "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate"
CRASH_FREE_USERS = "percentage(users_crashed, users) AS _crash_rate_alert_aggregate"
SESSION_AGGREGATE_TO_FIELD = {
    CRASH_FREE_SESSIONS: "sum(session)",
    CRASH_FREE_USERS: "count_unique(user)",
}


API_INTERVAL_POINTS_LIMIT = 10000
API_INTERVAL_POINTS_MIN = 150
TIME_FORMAT = "%Y-%m-%dT%H:%M:%S"


def incident_date_range(alert_time_window: int, incident: Incident) -> Mapping[str, str]:
    """
    Retrieve the start/end for graphing an incident.
    Will show at least 150 and no more than 10,000 data points.
    This function should match what is in the frontend.
    """
    time_window_milliseconds = alert_time_window * 1000
    min_range = time_window_milliseconds * API_INTERVAL_POINTS_MIN
    max_range = time_window_milliseconds * API_INTERVAL_POINTS_LIMIT
    now = timezone.now()
    start_date: datetime = incident.date_started
    end_date: datetime = incident.date_closed if incident.date_closed else now
    incident_range = max(
        (end_date - start_date).total_seconds() * 1000, 3 * time_window_milliseconds
    )
    range = min(max_range, max(min_range, incident_range))
    half_range = timedelta(milliseconds=range / 2)
    return {
        "start": (start_date - half_range).strftime(TIME_FORMAT),
        "end": min((end_date + half_range), now).strftime(TIME_FORMAT),
    }


def fetch_metric_alert_sessions_data(
    organization: Organization,
    rule_aggregate: str,
    query_params: Mapping[str, str],
    user: Optional["User"] = None,
) -> Any:
    try:
        resp = client.get(
            auth=ApiKey(organization_id=organization.id, scope_list=["org:read"]),
            user=user,
            path=f"/organizations/{organization.slug}/sessions/",
            params={
                "field": SESSION_AGGREGATE_TO_FIELD[rule_aggregate],
                "groupBy": "session.status",
                **query_params,
            },
        )
        return resp.data
    except Exception as exc:
        logger.exception(
            "Failed to load sessions for chart: %s",
            exc,
        )
        raise exc


def fetch_metric_alert_events_timeseries(
    organization: Organization,
    rule_aggregate: str,
    query_params: Mapping[str, str],
    user: Optional["User"] = None,
) -> List[Any]:
    try:
        resp = client.get(
            auth=ApiKey(organization_id=organization.id, scope_list=["org:read"]),
            user=user,
            path=f"/organizations/{organization.slug}/events-stats/",
            params={
                "yAxis": rule_aggregate,
                "referrer": "api.alerts.chartcuterie",
                **query_params,
            },
        )
        # Format the data into a timeseries object for charts
        series = {
            "seriesName": rule_aggregate,
            "data": [
                {
                    "name": point[0] * 1000,
                    "value": reduce(lambda a, b: a + float(b["count"] or 0), point[1], 0.0),
                }
                for point in resp.data["data"]
            ],
        }
        return [series]
    except Exception as exc:
        logger.error(
            "Failed to load events-stats for chart: %s",
            exc,
            exc_info=True,
        )
        raise exc


def fetch_metric_alert_incidents(
    organization: Organization,
    alert_rule: AlertRule,
    time_period: Mapping[str, str],
    user: Optional["User"] = None,
) -> List[Any]:
    try:
        resp = client.get(
            auth=ApiKey(organization_id=organization.id, scope_list=["org:read"]),
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
        return resp.data
    except Exception as exc:
        logger.error(
            "Failed to load incidents for chart: %s",
            exc,
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
    size: Optional[ChartSize] = None,
) -> Optional[str]:
    """Builds the dataset required for metric alert chart the same way the frontend would"""
    snuba_query: SnubaQuery = alert_rule.snuba_query
    dataset = Dataset(snuba_query.dataset)
    query_type = SnubaQuery.Type(snuba_query.type)
    is_crash_free_alert = query_type == SnubaQuery.Type.CRASH_RATE
    style = (
        ChartType.SLACK_METRIC_ALERT_SESSIONS
        if is_crash_free_alert
        else ChartType.SLACK_METRIC_ALERT_EVENTS
    )

    if selected_incident:
        time_period = incident_date_range(snuba_query.time_window, selected_incident)
    elif start and end:
        time_period = {"start": start, "end": end}
    else:
        period_start = get_datetime_from_stats_period(period if period else "10000m")
        time_period = {
            "start": period_start.strftime(TIME_FORMAT),
            "end": timezone.now().strftime(TIME_FORMAT),
        }

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

    allow_mri = features.has(
        "organizations:ddm-experimental",
        organization,
        actor=user,
    )
    aggregate = translate_aggregate_field(snuba_query.aggregate, reverse=True, allow_mri=allow_mri)
    # If we allow alerts to be across multiple orgs this will break
    first_subscription_or_none = snuba_query.subscriptions.first()
    if first_subscription_or_none is None:
        return None

    project_id = first_subscription_or_none.project_id
    time_window_minutes = snuba_query.time_window // 60
    env_params = {"environment": snuba_query.environment.name} if snuba_query.environment else {}
    query = (
        snuba_query.query
        if is_crash_free_alert
        else apply_dataset_query_conditions(
            SnubaQuery.Type(snuba_query.type),
            snuba_query.query,
            snuba_query.event_types,
            discover=True,
        )
    )

    query_params = {
        **env_params,
        **time_period,
        "project": str(project_id),
        "interval": f"{time_window_minutes}m",
        "query": query,
    }
    if is_crash_free_alert:
        chart_data["sessionResponse"] = fetch_metric_alert_sessions_data(
            organization,
            aggregate,
            query_params,
            user,
        )
    else:
        if query_type == SnubaQuery.Type.PERFORMANCE and dataset == Dataset.PerformanceMetrics:
            query_params["dataset"] = "metrics"
        elif query_type == SnubaQuery.Type.ERROR:
            query_params["dataset"] = "errors"
        else:
            query_params["dataset"] = "discover"
        chart_data["timeseriesData"] = fetch_metric_alert_events_timeseries(
            organization,
            aggregate,
            query_params,
            user,
        )

    try:
        return charts.generate_chart(style, chart_data, size=size)
    except RuntimeError as exc:
        logger.error(
            "Failed to generate chart for metric alert: %s",
            exc,
            exc_info=True,
        )
        return None
