from __future__ import annotations

import html
import logging
import re
from collections.abc import Mapping
from typing import Any, TypedDict
from urllib.parse import urlparse

from django.http.request import QueryDict

from sentry import analytics, features
from sentry.api import client
from sentry.charts import backend as charts
from sentry.charts.types import ChartSize, ChartType
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
from sentry.search.eap.types import SupportedTraceItemType
from sentry.snuba.referrer import Referrer
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.utils import json

_logger = logging.getLogger(__name__)

DEFAULT_PERIOD = "14d"
TOP_N = 5

EXPLORE_CHART_SIZE: ChartSize = {"width": 1600, "height": 1200}


class ExploreDatasetDefaults(TypedDict):
    title: str
    y_axis: str


EXPLORE_DATASET_DEFAULTS: dict[SupportedTraceItemType, ExploreDatasetDefaults] = {
    SupportedTraceItemType.SPANS: {
        "title": "Explore Traces",
        "y_axis": "count(span.duration)",
    },
    SupportedTraceItemType.LOGS: {
        "title": "Explore Logs",
        "y_axis": "count(message)",
    },
}


def _get_explore_dataset_defaults(dataset: SupportedTraceItemType) -> ExploreDatasetDefaults:
    """Returns the default title and y_axis for the given explore dataset."""
    return EXPLORE_DATASET_DEFAULTS.get(
        dataset, EXPLORE_DATASET_DEFAULTS[SupportedTraceItemType.SPANS]
    )


def _get_explore_dataset(url: str) -> SupportedTraceItemType:
    """Returns the dataset based on the explore URL."""
    if explore_logs_link_regex.match(url) or customer_domain_explore_logs_link_regex.match(url):
        return SupportedTraceItemType.LOGS
    return SupportedTraceItemType.SPANS


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
        chart_type = link.args.get("chart_type")

        explore_dataset = link.args.get("dataset", SupportedTraceItemType.SPANS)
        defaults = _get_explore_dataset_defaults(explore_dataset)

        y_axes = params.getlist("yAxis")
        if not y_axes:
            y_axes = [defaults["y_axis"]]
            params.setlist("yAxis", y_axes)

        group_bys = params.getlist("groupBy")

        style = ChartType.SLACK_EXPLORE_LINE
        if group_bys:
            params.setlist("topEvents", [str(TOP_N)])
            if not params.getlist("sort"):
                # Default to descending by the first yAxis, matching Explore's
                # defaultAggregateSortBys behavior
                params.setlist("sort", [f"-{y_axes[0]}"])

        if not params.get("statsPeriod") and not params.get("start"):
            params["statsPeriod"] = DEFAULT_PERIOD

        params["dataset"] = explore_dataset.value
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

        chart_data: dict[str, Any] = {
            "timeSeries": resp.data.get("timeSeries", []),
            "type": _resolve_display_type(chart_type, y_axes),
        }

        try:
            url = charts.generate_chart(style, chart_data, size=EXPLORE_CHART_SIZE)
        except RuntimeError:
            _logger.warning("Failed to generate chart for explore unfurl")
            continue

        # Only one chart/y-axis is supported at a time in Explore
        title = f"{defaults['title']} - {y_axes[0]}"
        unfurls[link.url] = SlackDiscoverMessageBuilder(
            title=title,
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


CHART_TYPE_TO_DISPLAY_TYPE = {
    0: "bar",
    1: "line",
    2: "area",
}

# Aggregates that default to bar charts in Explore's determineDefaultChartType.
# All other aggregates default to line.
_BAR_AGGREGATES = {"count", "count_unique", "sum"}


def _resolve_display_type(chart_type: int | None, y_axes: list[str]) -> str:
    """Return the display type string for the chart.

    Uses the explicit chartType from the URL when present, otherwise
    mirrors the frontend's ``determineDefaultChartType`` logic which
    maps count/count_unique/sum aggregates to bar and everything else
    to line.
    """
    if chart_type is not None:
        return CHART_TYPE_TO_DISPLAY_TYPE.get(chart_type, "line")

    for y_axis in y_axes:
        func_name = y_axis.split("(")[0] if "(" in y_axis else ""
        if func_name in _BAR_AGGREGATES:
            return "bar"
    return "line"


def map_explore_query_args(url: str, args: Mapping[str, str | None]) -> Mapping[str, Any]:
    """
    Extracts explore arguments from the explore link's query string.
    Parses visualize/aggregateField JSON params to extract yAxes, groupBy, and chartType.
    """
    # Slack uses HTML escaped ampersands in its Event Links
    url = html.unescape(url)
    parsed_url = urlparse(url)
    raw_query = QueryDict(parsed_url.query)

    explore_dataset = _get_explore_dataset(url)

    # Parse visualize (spans explore) or aggregateField (logs explore) JSON params
    visualize_fields = raw_query.getlist("visualize") or raw_query.getlist("aggregateField")
    y_axes: list[str] = []
    group_bys: list[str] = []
    chart_type: int | None = None
    for field_json in visualize_fields:
        try:
            parsed = json.loads(field_json)
            if "yAxes" in parsed and isinstance(parsed["yAxes"], list):
                y_axes.extend(parsed["yAxes"])
            if "groupBy" in parsed and parsed["groupBy"]:
                group_bys.append(parsed["groupBy"])
            if chart_type is None and isinstance(parsed.get("chartType"), int):
                chart_type = parsed["chartType"]
        except (json.JSONDecodeError, TypeError):
            continue

    if not y_axes:
        y_axes = [_get_explore_dataset_defaults(explore_dataset)["y_axis"]]

    # Build query params
    query = QueryDict(mutable=True)
    query.setlist("yAxis", y_axes)

    if group_bys:
        query.setlist("groupBy", group_bys)

    # Copy standard params
    for param in ("project", "statsPeriod", "start", "end", "query", "environment", "interval"):
        values = raw_query.getlist(param)
        if values:
            query.setlist(param, values)

    # Explore stores the aggregate sort as "aggregateSort" in the URL;
    # the events-timeseries endpoint expects it as "sort".
    aggregate_sort = raw_query.getlist("aggregateSort")
    if aggregate_sort:
        query.setlist("sort", aggregate_sort)

    return dict(**args, query=query, chart_type=chart_type, dataset=explore_dataset)


explore_traces_link_regex = re.compile(
    r"^https?\://(?#url_prefix)[^/]+/organizations/(?P<org_slug>[^/]+)/explore/traces/"
)

customer_domain_explore_traces_link_regex = re.compile(
    r"^https?\://(?P<org_slug>[^.]+?)\.(?#url_prefix)[^/]+/explore/traces/"
)

explore_logs_link_regex = re.compile(
    r"^https?\://(?#url_prefix)[^/]+/organizations/(?P<org_slug>[^/]+)/explore/logs/"
)

customer_domain_explore_logs_link_regex = re.compile(
    r"^https?\://(?P<org_slug>[^.]+?)\.(?#url_prefix)[^/]+/explore/logs/"
)

explore_handler = Handler(
    fn=unfurl_explore,
    matcher=[
        explore_traces_link_regex,
        customer_domain_explore_traces_link_regex,
        explore_logs_link_regex,
        customer_domain_explore_logs_link_regex,
    ],
    arg_mapper=map_explore_query_args,
)
