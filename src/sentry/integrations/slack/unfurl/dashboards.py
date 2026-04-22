from __future__ import annotations

import html
import logging
import re
from collections.abc import Mapping
from typing import Any, TypedDict, cast
from urllib.parse import urlparse

from django.http.request import QueryDict

from sentry import analytics, features
from sentry.api import client
from sentry.api.endpoints.timeseries import TimeSeries
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
from sentry.models.dashboard_widget import (
    DashboardWidget,
    DashboardWidgetDisplayTypes,
    DashboardWidgetQuery,
    DashboardWidgetTypes,
)
from sentry.models.organization import Organization
from sentry.search.eap.types import SupportedTraceItemType
from sentry.snuba.referrer import Referrer
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser


class DashboardsUnfurlArgs(TypedDict):
    org_slug: str
    dashboard_id: int
    widget_index: int
    query: QueryDict


_logger = logging.getLogger(__name__)

DEFAULT_PERIOD = "14d"
TOP_N = 5

DASHBOARDS_CHART_SIZE: ChartSize = {"width": 1200, "height": 400}

# Display types where a timeseries chart makes sense. Other display types
# (table, big number, text, etc.) are not supported for unfurl yet.
_TIMESERIES_DISPLAY_TYPES = {
    DashboardWidgetDisplayTypes.LINE_CHART: "line",
    DashboardWidgetDisplayTypes.AREA_CHART: "area",
    DashboardWidgetDisplayTypes.STACKED_AREA_CHART: "area",
    DashboardWidgetDisplayTypes.BAR_CHART: "bar",
    DashboardWidgetDisplayTypes.TOP_N: "area",
}


def unfurl_dashboards(
    integration: Integration | RpcIntegration,
    links: list[UnfurlableUrl],
    user: User | RpcUser | None = None,
) -> UnfurledUrl:
    with MessagingInteractionEvent(
        MessagingInteractionType.UNFURL_DASHBOARDS, SlackMessagingSpec(), user=user
    ).capture() as lifecycle:
        lifecycle.add_extras({"integration_id": integration.id})
        return _unfurl_dashboards(integration, links, user)


def _unfurl_dashboards(
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

    enabled_orgs = {
        slug: org
        for slug, org in orgs_by_slug.items()
        if features.has("organizations:dashboards-widget-unfurl", org, actor=user)
    }
    if not enabled_orgs:
        return {}

    unfurls = {}

    for link in links:
        args = cast(DashboardsUnfurlArgs, link.args)
        org_slug = args["org_slug"]
        org = enabled_orgs.get(org_slug)

        if not org:
            continue

        widget = _get_widget(org.id, args["dashboard_id"], args["widget_index"])
        if widget is None:
            continue

        # Only spans are supported for the initial rollout.
        if widget.widget_type != DashboardWidgetTypes.SPANS:
            continue

        display_type = _TIMESERIES_DISPLAY_TYPES.get(widget.display_type)
        if display_type is None:
            continue

        widget_queries = list(
            DashboardWidgetQuery.objects.filter(widget_id=widget.id).order_by("order")
        )
        if not widget_queries:
            continue

        combined_time_series: list[TimeSeries] = []
        request_failed = False
        for widget_query in widget_queries:
            params = _build_timeseries_params(widget_query, args["query"])

            try:
                resp = client.get(
                    auth=ApiKey(organization_id=org.id, scope_list=["org:read"]),
                    user=user,
                    path=f"/organizations/{org_slug}/events-timeseries/",
                    params=params,
                )
            except Exception:
                _logger.warning("Failed to load events-timeseries for dashboards unfurl")
                request_failed = True
                break

            combined_time_series.extend(resp.data.get("timeSeries", []))

        if request_failed:
            continue

        chart_data: dict[str, Any] = {
            "timeSeries": combined_time_series,
            "type": display_type,
        }

        try:
            url = charts.generate_chart(
                ChartType.SLACK_TIMESERIES, chart_data, size=DASHBOARDS_CHART_SIZE
            )
        except RuntimeError:
            _logger.warning("Failed to generate chart for dashboards unfurl")
            continue

        unfurls[link.url] = SlackDiscoverMessageBuilder(
            title=widget.title,
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


def _get_widget(
    organization_id: int, dashboard_id: int, widget_index: int
) -> DashboardWidget | None:
    """Look up the widget at the given index within an org's dashboard.

    The URL's widget segment is the 0-based position in the dashboard's
    widget list as returned by the API (ordered by id), matching the
    frontend's ``dashboard.widgets[widgetId]`` lookup.
    """
    widgets = list(
        DashboardWidget.objects.filter(
            dashboard_id=dashboard_id,
            dashboard__organization_id=organization_id,
        ).order_by("id")
    )
    if widget_index >= len(widgets):
        return None
    return widgets[widget_index]


def _build_timeseries_params(
    widget_query: DashboardWidgetQuery, url_params: QueryDict
) -> dict[str, str | list[str]]:
    """Build events-timeseries API params from a widget query + URL params.

    Returns a plain dict with list values for multi-valued params. ``client.get``
    iterates ``params.items()`` and only honors multiple values when the value
    is a ``list``; a ``QueryDict`` would silently drop all but the last value.
    """
    params: dict[str, str | list[str]] = {}

    aggregates = list(widget_query.aggregates or [])
    columns = list(widget_query.columns or [])

    params["yAxis"] = aggregates

    if columns:
        params["groupBy"] = columns
        params["topEvents"] = str(TOP_N)

    if widget_query.conditions:
        params["query"] = widget_query.conditions

    if widget_query.orderby:
        params["sort"] = widget_query.orderby
    elif columns and aggregates:
        # Match Explore behavior: default to descending by the first yAxis
        # when grouping without an explicit sort.
        params["sort"] = f"-{aggregates[0]}"

    for param in ("project", "environment", "statsPeriod", "start", "end", "interval"):
        values = url_params.getlist(param)
        if values:
            params[param] = values if len(values) > 1 else values[0]

    if "statsPeriod" not in params and "start" not in params:
        params["statsPeriod"] = DEFAULT_PERIOD

    params["dataset"] = SupportedTraceItemType.SPANS.value
    params["referrer"] = Referrer.DASHBOARDS_SLACK_UNFURL.value

    return params


def map_dashboards_query_args(url: str, args: Mapping[str, str | None]) -> DashboardsUnfurlArgs:
    """Extract the dashboard widget args and URL query params.

    The regex matchers guarantee ``org_slug``, ``dashboard_id``, and
    ``widget_index`` are all non-None and numeric where applicable, so
    the casts below cannot fail for any url that reaches this function.
    """
    url = html.unescape(url)
    parsed_url = urlparse(url)

    return {
        "org_slug": args["org_slug"] or "",
        "dashboard_id": int(args["dashboard_id"] or 0),
        "widget_index": int(args["widget_index"] or 0),
        "query": QueryDict(parsed_url.query),
    }


dashboards_link_regex = re.compile(
    r"^https?\://(?#url_prefix)[^/]+/organizations/(?P<org_slug>[^/]+)/dashboard/(?P<dashboard_id>\d+)/widget/(?P<widget_index>\d+)/?(?=[?#]|$)"
)

customer_domain_dashboards_link_regex = re.compile(
    r"^https?\://(?P<org_slug>[^.]+?)\.(?#url_prefix)[^/]+/dashboard/(?P<dashboard_id>\d+)/widget/(?P<widget_index>\d+)/?(?=[?#]|$)"
)


dashboards_handler = Handler(
    fn=unfurl_dashboards,
    matcher=[
        dashboards_link_regex,
        customer_domain_dashboards_link_regex,
    ],
    arg_mapper=map_dashboards_query_args,
)
