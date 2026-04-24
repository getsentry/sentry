from __future__ import annotations

import html
import logging
import re
from collections.abc import Mapping
from typing import Any, TypedDict, cast
from urllib.parse import urlparse

from django.db.models import Prefetch
from django.http.request import QueryDict

from sentry import analytics, features
from sentry.api import client
from sentry.api.endpoints.timeseries import TimeSeries
from sentry.charts import backend as charts
from sentry.charts.types import ChartSize, ChartType
from sentry.constants import ALL_ACCESS_PROJECT_ID
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

# Matches the dashboards-specific DEFAULT_STATS_PERIOD in
# static/app/views/dashboards/data.tsx so unfurls show the same window the
# dashboard UI does when no period is set anywhere.
DEFAULT_PERIOD = "24h"
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

# Widget types that map to datasets on the events-timeseries endpoint. Other
# widget types (discover, issue, metrics, transaction-like, etc.) are skipped.
_WIDGET_TYPE_TO_DATASET: dict[int, str] = {
    DashboardWidgetTypes.SPANS: SupportedTraceItemType.SPANS.value,
    DashboardWidgetTypes.LOGS: SupportedTraceItemType.LOGS.value,
    DashboardWidgetTypes.TRACEMETRICS: SupportedTraceItemType.TRACEMETRICS.value,
    DashboardWidgetTypes.ERROR_EVENTS: "errors",
    DashboardWidgetTypes.PREPROD_APP_SIZE: "preprodSize",
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

        is_supported_dataset = widget.widget_type in _WIDGET_TYPE_TO_DATASET
        if not is_supported_dataset:
            continue

        display_type = _TIMESERIES_DISPLAY_TYPES.get(widget.display_type)
        if display_type is None:
            continue

        per_query_params = build_widget_timeseries_params(widget, args["query"])
        if not per_query_params:
            continue

        combined_time_series: list[TimeSeries] = []
        request_failed = False
        for params in per_query_params:
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
    frontend's ``dashboard.widgets[widgetId]`` lookup. Widget queries are
    prefetched in ``order`` so the downstream helper doesn't need DB access.
    """
    widgets = list(
        DashboardWidget.objects.filter(
            dashboard_id=dashboard_id,
            dashboard__organization_id=organization_id,
        )
        .select_related("dashboard")
        .prefetch_related(
            Prefetch(
                "dashboardwidgetquery_set",
                queryset=DashboardWidgetQuery.objects.order_by("order"),
            )
        )
        .order_by("id")
    )
    if widget_index >= len(widgets):
        return None
    return widgets[widget_index]


def build_widget_timeseries_params(
    widget: DashboardWidget, url_params: QueryDict
) -> list[dict[str, str | list[str]]]:
    """Build one events-timeseries param dict per widget query."""
    dataset = _WIDGET_TYPE_TO_DATASET.get(widget.widget_type)
    if dataset is None:
        raise ValueError(f"Unsupported widget type: {widget.widget_type}")

    dashboard_filters = widget.dashboard.get_filters()

    return [
        _params_for_widget_query(wq, url_params, dataset, dashboard_filters)
        for wq in widget.dashboardwidgetquery_set.all()
    ]


def _params_for_widget_query(
    widget_query: DashboardWidgetQuery,
    url_params: QueryDict,
    dataset: str,
    dashboard_filters: Mapping[str, Any],
) -> dict[str, str | list[str]]:
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

    _apply_page_filters(params, url_params, dashboard_filters)

    params["dataset"] = dataset
    params["referrer"] = Referrer.DASHBOARDS_SLACK_UNFURL.value

    return params


def _apply_page_filters(
    params: dict[str, str | list[str]],
    url_params: QueryDict,
    dashboard_filters: Mapping[str, Any],
) -> None:
    """Resolve page filters (project, environment, date range, interval).

    Precedence mirrors the dashboard UI's PageFilters resolution:
      URL query params -> dashboard-saved filters -> hardcoded FE defaults.
    localStorage-pinned filters are deliberately not replicated; they aren't
    reachable from a webhook context.
    """
    # project: URL wins. Otherwise fall back to the dashboard's projects.
    # An unconfigured dashboard (no projects, no all_projects) falls through
    # to "All Projects" so the unfurl shows data instead of an empty chart.
    project_values = url_params.getlist("project")
    if not project_values:
        project_values = [str(p) for p in dashboard_filters.get("projects") or []]
    if not project_values:
        project_values = [str(ALL_ACCESS_PROJECT_ID)]
    params["project"] = project_values if len(project_values) > 1 else project_values[0]

    # environment: URL wins. Otherwise fall back to dashboard, or omit (no
    # filter) to match the FE default of "All Environments".
    env_values = url_params.getlist("environment")
    if not env_values:
        env_values = list(dashboard_filters.get("environment") or [])
    if env_values:
        params["environment"] = env_values if len(env_values) > 1 else env_values[0]

    # Date range: treat as a single unit. If the URL carries any date info at
    # all, trust it holistically (don't mix URL start with dashboard period).
    # ``utc`` is intentionally not forwarded: the events-timeseries endpoint
    # doesn't consume it, and unfurls are shared across mixed-timezone audiences.
    url_start = url_params.get("start")
    url_end = url_params.get("end")
    url_stats_period = url_params.get("statsPeriod")

    if url_stats_period or url_start or url_end:
        if url_stats_period:
            params["statsPeriod"] = url_stats_period
        if url_start:
            params["start"] = url_start
        if url_end:
            params["end"] = url_end
    else:
        dash_start = dashboard_filters.get("start")
        dash_end = dashboard_filters.get("end")
        dash_period = dashboard_filters.get("period")
        if dash_start and dash_end:
            params["start"] = str(dash_start)
            params["end"] = str(dash_end)
        elif dash_period:
            params["statsPeriod"] = str(dash_period)
        else:
            params["statsPeriod"] = DEFAULT_PERIOD

    interval_value = url_params.get("interval")
    if interval_value:
        params["interval"] = interval_value


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
