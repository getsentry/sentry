from __future__ import annotations

import html
import logging
import re
from collections.abc import Mapping
from datetime import timedelta
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
from sentry.utils.dates import get_interval_from_range, parse_stats_period

_logger = logging.getLogger(__name__)

DEFAULT_PERIOD = "14d"
DEFAULT_Y_AXIS = "count(span.duration)"

# All `multiPlotType: line` fields in /static/app/utils/discover/fields.tsx
LINE_PLOT_FIELDS = {
    "count_unique",
    "min",
    "max",
    "p50",
    "p75",
    "p90",
    "p95",
    "p99",
    "p100",
    "percentile",
    "avg",
    "sum",
}

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
    unfurls = {}

    for link in links:
        org_slug = link.args["org_slug"]
        org = orgs_by_slug.get(org_slug)

        if not org:
            continue
        if not features.has("organizations:data-browsing-widget-unfurl", org, actor=user):
            continue

        params = link.args["query"]

        y_axes = params.getlist("yAxis")
        if not y_axes:
            y_axes = [DEFAULT_Y_AXIS]
            params.setlist("yAxis", y_axes)

        group_bys = params.getlist("field")

        # Determine display mode based on whether groupBy is present
        if group_bys:
            y_axis = y_axes[0]
            aggregate_fn = y_axis.split("(")[0]
            if aggregate_fn in LINE_PLOT_FIELDS:
                display_mode = "top5line"
                style = ChartType.SLACK_DISCOVER_TOP5_PERIOD_LINE
            else:
                display_mode = "top5"
                style = ChartType.SLACK_DISCOVER_TOP5_PERIOD
            params.setlist("topEvents", [str(TOP_N)])
        else:
            display_mode = "default"
            style = ChartType.SLACK_DISCOVER_TOTAL_PERIOD

        # Compute interval from time range
        delta = timedelta(days=90)
        if "statsPeriod" in params:
            if (parsed_period := parse_stats_period(params["statsPeriod"])) is not None:
                delta = parsed_period
        elif not params.get("statsPeriod") and not params.get("start"):
            params["statsPeriod"] = DEFAULT_PERIOD
            delta = timedelta(days=14)

        if "daily" in display_mode:
            params.setlist("interval", ["1d"])
        else:
            interval = get_interval_from_range(delta, False)
            params.setlist("interval", [interval])

        params["referrer"] = Referrer.EXPLORE_SLACK_UNFURL.value

        try:
            resp = client.get(
                auth=ApiKey(organization_id=org.id, scope_list=["org:read"]),
                user=user,
                path=f"/organizations/{org_slug}/events-stats/",
                params=params,
            )
        except Exception:
            _logger.warning("Failed to load events-stats for explore unfurl")
            continue

        chart_data = {"seriesName": params.get("yAxis"), "stats": resp.data}

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
            if "yAxes" in parsed:
                y_axes.extend(parsed["yAxes"])
            if "groupBy" in parsed and parsed["groupBy"]:
                group_bys.append(parsed["groupBy"])
        except (json.JSONDecodeError, TypeError):
            continue

    if not y_axes:
        y_axes = [DEFAULT_Y_AXIS]

    # Build query params for events-stats endpoint
    query = QueryDict(mutable=True)
    query.setlist("yAxis", y_axes)
    query["dataset"] = "spans"

    if group_bys:
        query.setlist("field", group_bys)

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
