from __future__ import annotations

import html
import logging
import re
from collections.abc import Mapping
from typing import Any
from urllib.parse import urlparse

from django.http.request import QueryDict

from sentry import analytics, features
from sentry.api import client
from sentry.charts import backend as charts
from sentry.charts.types import ChartType
from sentry.integrations.messaging.metrics import (
    MessagingInteractionEvent,
    MessagingInteractionType,
)
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration import RpcIntegration, integration_service
from sentry.integrations.slack.analytics import SlackIntegrationChartUnfurl
from sentry.integrations.slack.message_builder.discover import SlackDiscoverMessageBuilder
from sentry.integrations.slack.spec import SlackMessagingSpec
from sentry.integrations.slack.unfurl.types import Handler, UnfurlableUrl, UnfurledUrl
from sentry.models.apikey import ApiKey
from sentry.models.organization import Organization
from sentry.snuba.referrer import Referrer
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.utils import json

_logger = logging.getLogger(__name__)

DEFAULT_PERIOD = "14d"
DEFAULT_Y_AXIS = "count(span.duration)"
TOP_N = 5


def unfurl_explore(
    integration: Integration | RpcIntegration,
    links: list[UnfurlableUrl],
    user: User | RpcUser | None = None,
) -> UnfurledUrl:
    with MessagingInteractionEvent(
        MessagingInteractionType.UNFURL_EXPLORE, SlackMessagingSpec(), user=user
    ).capture() as lifecycle:
        lifecycle.add_extras({"integration_id": integration.id})
        return _unfurl_explore(integration, links, user)


def _unfurl_explore(
    integration: Integration | RpcIntegration,
    links: list[UnfurlableUrl],
    user: User | RpcUser | None = None,
) -> UnfurledUrl:
    org_integrations = integration_service.get_organization_integrations(
        integration_id=integration.id
    )
    organizations = Organization.objects.filter(
        id__in=[oi.organization_id for oi in org_integrations]
    )
    orgs_by_slug = {org.slug: org for org in organizations}

    # Check if any org has the feature flag enabled before doing any work
    enabled_orgs = {
        slug: org
        for slug, org in orgs_by_slug.items()
        if features.has("organizations:data-browsing-widget-unfurl", org, actor=user)
    }
    if not enabled_orgs:
        return {}

    unfurls = {}

    for link in links:
        org_slug = link.args["org_slug"]
        org = enabled_orgs.get(org_slug)

        if not org:
            continue

        params = link.args["query"]

        y_axes = params.getlist("yAxis")
        if not y_axes:
            y_axes = [DEFAULT_Y_AXIS]
            params.setlist("yAxis", y_axes)

        group_bys = params.getlist("groupBy")

        style = ChartType.SLACK_EXPLORE_LINE
        if group_bys:
            params.setlist("topEvents", [str(TOP_N)])

        if not params.get("statsPeriod") and not params.get("start"):
            params["statsPeriod"] = DEFAULT_PERIOD

        params["dataset"] = "spans"
        params["referrer"] = Referrer.EXPLORE_SLACK_UNFURL.value

        try:
            resp = client.get(
                auth=ApiKey(organization_id=org.id, scope_list=["org:read"]),
                user=user,
                path=f"/organizations/{org_slug}/events-timeseries/",
                params=params,
            )
        except Exception:
            _logger.warning("Failed to load events-timeseries for explore unfurl")
            continue

        chart_data = {
            "timeSeries": resp.data.get("timeSeries", []),
        }

        try:
            url = charts.generate_chart(style, chart_data)
        except RuntimeError:
            _logger.warning("Failed to generate chart for explore unfurl")
            continue

        unfurls[link.url] = SlackDiscoverMessageBuilder(
            title="Explore Traces",
            chart_url=url,
        ).build()

    first_org_integration = org_integrations[0] if len(org_integrations) > 0 else None
    if first_org_integration is not None and hasattr(first_org_integration, "id"):
        analytics.record(
            SlackIntegrationChartUnfurl(
                organization_id=first_org_integration.organization_id,
                user_id=user.id if user else None,
                unfurls_count=len(unfurls),
            )
        )

    return unfurls


def map_explore_query_args(url: str, args: Mapping[str, str | None]) -> Mapping[str, Any]:
    """
    Extracts explore arguments from the explore link's query string.
    Parses aggregateField JSON params to extract yAxes and groupBy.
    """
    # Slack uses HTML escaped ampersands in its Event Links
    url = html.unescape(url)
    parsed_url = urlparse(url)
    raw_query = QueryDict(parsed_url.query)

    # Parse aggregateField JSON params
    aggregate_fields = raw_query.getlist("aggregateField")
    y_axes: list[str] = []
    group_bys: list[str] = []
    for field_json in aggregate_fields:
        try:
            parsed = json.loads(field_json)
            if "yAxes" in parsed and isinstance(parsed["yAxes"], list):
                y_axes.extend(parsed["yAxes"])
            if "groupBy" in parsed and parsed["groupBy"]:
                group_bys.append(parsed["groupBy"])
        except (json.JSONDecodeError, TypeError):
            continue

    if not y_axes:
        y_axes = [DEFAULT_Y_AXIS]

    # Build query params
    query = QueryDict(mutable=True)
    query.setlist("yAxis", y_axes)

    if group_bys:
        query.setlist("groupBy", group_bys)

    # Copy standard params
    for param in ("project", "statsPeriod", "start", "end", "query", "environment"):
        values = raw_query.getlist(param)
        if values:
            query.setlist(param, values)

    return dict(**args, query=query)


explore_traces_link_regex = re.compile(
    r"^https?\://(?#url_prefix)[^/]+/organizations/(?P<org_slug>[^/]+)/explore/traces/"
)

customer_domain_explore_traces_link_regex = re.compile(
    r"^https?\://(?P<org_slug>[^.]+?)\.(?#url_prefix)[^/]+/explore/traces/"
)

explore_handler = Handler(
    fn=unfurl_explore,
    matcher=[
        explore_traces_link_regex,
        customer_domain_explore_traces_link_regex,
    ],
    arg_mapper=map_explore_query_args,
)
