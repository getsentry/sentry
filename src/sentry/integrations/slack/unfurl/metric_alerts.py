import html
import re
from typing import Any, List, Mapping, Optional
from urllib.parse import urlparse

from django.db.models import Q
from django.http.request import HttpRequest, QueryDict

from sentry.incidents.models import AlertRule, Incident, User
from sentry.integrations.slack.message_builder.metric_alerts import SlackMetricAlertMessageBuilder
from sentry.models import Integration

from . import Handler, UnfurlableUrl, UnfurledUrl, make_type_coercer

map_incident_args = make_type_coercer(
    {
        "org_slug": str,
        "alert_rule_id": int,
        "incident_id": int,
    }
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

    return {
        link.url: SlackMetricAlertMessageBuilder(
            alert_rule=alert_rule_map[link.args["alert_rule_id"]],
            incident=incident_map.get(link.args["incident_id"]),
        ).build()
        for link in links
        if link.args["alert_rule_id"] in alert_rule_map
    }


def map_metric_alert_query_args(url: str, args: Mapping[str, str]) -> Mapping[str, Any]:
    """
    Extracts selected incident id
    """
    # Slack uses HTML escaped ampersands in its Event Links, when need
    # to be unescaped for QueryDict to split properly.
    url = html.unescape(url)
    parsed_url = urlparse(url)
    params = QueryDict(parsed_url.query)
    incident_id = params.get("alert", None)

    return map_incident_args(url, {**args, "incident_id": incident_id})


handler: Handler = Handler(
    fn=unfurl_metric_alerts,
    matcher=re.compile(
        r"^https?\://[^/]+/organizations/(?P<org_slug>[^/]+)/alerts/rules/details/(?P<alert_rule_id>\d+)"
    ),
    arg_mapper=map_metric_alert_query_args,
)
