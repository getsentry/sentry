import html
import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Mapping, Optional
from urllib.parse import urlparse

from django.db.models import Q
from django.http.request import HttpRequest, QueryDict
from django.utils import timezone

from sentry import features
from sentry.api import client
from sentry.api.serializers import serialize
from sentry.api.serializers.models.alert_rule import AlertRuleSerializer
from sentry.api.serializers.models.incident import DetailedIncidentSerializer
from sentry.charts import generate_chart
from sentry.charts.types import ChartType
from sentry.incidents.logic import translate_aggregate_field
from sentry.incidents.models import AlertRule, Incident, User
from sentry.integrations.slack.message_builder.metric_alerts import SlackMetricAlertMessageBuilder
from sentry.models import ApiKey, Integration, Organization
from sentry.snuba.dataset import Dataset

from ..utils import logger
from . import Handler, UnfurlableUrl, UnfurledUrl, make_type_coercer

map_incident_args = make_type_coercer(
    {
        "org_slug": str,
        "alert_rule_id": int,
        "incident_id": int,
        "period": str,
        "start": str,
        "end": str,
    }
)

API_INTERVAL_POINTS_LIMIT = 10000
API_INTERVAL_POINTS_MIN = 150

CRASH_FREE_SESSIONS = "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate"
CRASH_FREE_USERS = "percentage(users_crashed, users) AS _crash_rate_alert_aggregate"
SESSION_AGGREGATE_TO_FIELD = {
    CRASH_FREE_SESSIONS: "sum(session)",
    CRASH_FREE_USERS: "count_unique(user)",
}


def fetch_metric_alert_sessions_data(
    organization: Organization,
    alert_rule: AlertRule,
    time_period: Dict[str, Any],
    user: Optional["User"] = None,
):
    env = alert_rule.snuba_query.environment
    aggregate = translate_aggregate_field(alert_rule.snuba_query.aggregate, reverse=True)
    project_id = alert_rule.snuba_query.subscriptions.select_related("project").first().project.id

    if "period" in time_period:
        time_period = {"statsPeriod": time_period["period"]}

    try:
        resp = client.get(
            auth=ApiKey(organization=organization, scope_list=["org:read"]),
            user=user,
            path=f"/organizations/{organization.slug}/sessions/",
            params={
                "environment": env.name if env else None,
                "field": SESSION_AGGREGATE_TO_FIELD[aggregate],
                "interval": f"{alert_rule.snuba_query.time_window}m",
                "project": project_id,
                "query": alert_rule.snuba_query.query,
                "groupBy": "session.status",
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


def fetch_metric_alert_events(
    organization: Organization,
    alert_rule: AlertRule,
    time_period: Dict[str, Any],
    user: Optional["User"] = None,
):
    env = alert_rule.snuba_query.environment
    aggregate = translate_aggregate_field(alert_rule.snuba_query.aggregate, reverse=True)
    try:
        resp = client.get(
            auth=ApiKey(organization=organization, scope_list=["org:read"]),
            user=user,
            path=f"/organizations/{organization.slug}/events-stats/",
            params={
                "environment": env.name if env else None,
                "query": alert_rule.snuba_query.query,
                "interval": f"{alert_rule.snuba_query.time_window}m",
                "yAxis": aggregate,
                **time_period,
            },
        )
        return resp.data
    except Exception as exc:
        logger.error(
            f"Failed to load events-stats for chart: {exc}",
            exc_info=True,
        )
        return None


def fetch_metric_alert_incidents(
    organization: Organization,
    alert_rule: AlertRule,
    time_period: Dict[str, Any],
    user: Optional["User"] = None,
):
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
        return resp.data
    except Exception as exc:
        logger.error(
            f"Failed to load incidents for chart: {exc}",
            exc_info=True,
        )
        return []


def incident_date_range(alert_rule: AlertRule, incident: Incident):
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


def build_metric_alert_chart(
    organization: Organization,
    alert_rule: AlertRule,
    selected_incident: Optional[Incident],
    period: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    user: Optional["User"] = None,
):
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
        chart_data["timeseriesData"] = fetch_metric_alert_events(
            organization,
            alert_rule,
            time_period,
            user,
        )

    try:
        url = generate_chart(style, chart_data)
        return url
    except RuntimeError as exc:
        logger.error(
            f"Failed to generate chart for discover unfurl: {exc}",
            exc_info=True,
        )


def unfurl_metric_alerts(
    request: HttpRequest,
    integration: Integration,
    links: List[UnfurlableUrl],
    user: Optional["User"] = None,
) -> UnfurledUrl:
    alert_filter_query = Q()
    incident_filter_query = Q()
    # Since we don't have real ids here, we use the org slug so that we can
    # make sure the identifiers correspond to the correct organization.
    for link in links:
        org_slug = link.args["org_slug"]
        alert_rule_id = link.args["alert_rule_id"]
        incident_id = link.args["incident_id"]

        if incident_id:
            incident_filter_query |= Q(
                identifier=incident_id, organization__slug=org_slug, alert_rule__id=alert_rule_id
            )
        else:
            alert_filter_query |= Q(id=alert_rule_id, organization__slug=org_slug)

    all_integration_orgs = integration.organizations.all()
    alert_rule_map = {
        rule.id: rule
        for rule in AlertRule.objects.filter(
            alert_filter_query,
            # Filter by integration organization here as well to make sure that
            # we have permission to access these incidents.
            organization__in=all_integration_orgs,
        )
    }

    if not alert_rule_map:
        return {}

    incident_map = {
        i.identifier: i
        for i in Incident.objects.filter(
            incident_filter_query,
            # Filter by integration organization here as well to make sure that
            # we have permission to access these incidents.
            organization__in=all_integration_orgs,
        )
    }

    orgs_by_slug: Dict[str, Organization] = {org.slug: org for org in all_integration_orgs}

    result: UnfurledUrl = {}
    for link in links:
        if link.args["alert_rule_id"] not in alert_rule_map:
            continue
        org = orgs_by_slug.get(link.args["org_slug"])
        if org is None:
            continue

        alert_rule = alert_rule_map[link.args["alert_rule_id"]]
        selected_incident = incident_map.get(link.args["incident_id"])

        # TODO: add feature flag
        if features.has("organizations:metric-alert-chartcuterie", org):
            build_metric_alert_chart(
                organization=org,
                alert_rule=alert_rule,
                selected_incident=selected_incident,
                period=link.args["period"],
                start=link.args["start"],
                end=link.args["end"],
                user=user,
            )

        result[link.url] = SlackMetricAlertMessageBuilder(
            alert_rule=alert_rule,
            incident=selected_incident,
        ).build()

    return result


def map_metric_alert_query_args(url: str, args: Mapping[str, str]) -> Mapping[str, Any]:
    """Extracts selected incident id and some query parameters"""

    # Slack uses HTML escaped ampersands in its Event Links, when need
    # to be unescaped for QueryDict to split properly.
    url = html.unescape(url)
    parsed_url = urlparse(url)
    params = QueryDict(parsed_url.query)
    incident_id = params.get("alert", None)
    period = params.get("period", None)
    start = params.get("start", None)
    end = params.get("end", None)

    return map_incident_args(
        url, {**args, "incident_id": incident_id, "period": period, "start": start, "end": end}
    )


handler: Handler = Handler(
    fn=unfurl_metric_alerts,
    matcher=re.compile(
        r"^https?\://[^/]+/organizations/(?P<org_slug>[^/]+)/alerts/rules/details/(?P<alert_rule_id>\d+)"
    ),
    arg_mapper=map_metric_alert_query_args,
)
