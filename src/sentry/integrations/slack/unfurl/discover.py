from __future__ import annotations

import html
import re
from datetime import timedelta
from typing import Any, Mapping
from urllib.parse import urlparse

from django.http.request import HttpRequest, QueryDict

from sentry import analytics, features
from sentry.api import client
from sentry.charts import backend as charts
from sentry.charts.types import ChartType
from sentry.discover.arithmetic import is_equation
from sentry.integrations.slack.message_builder.discover import SlackDiscoverMessageBuilder
from sentry.models.apikey import ApiKey
from sentry.models.integrations.integration import Integration
from sentry.models.organization import Organization
from sentry.models.user import User
from sentry.search.events.filter import to_list
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.utils.dates import (
    get_interval_from_range,
    parse_stats_period,
    parse_timestamp,
    validate_interval,
)

from ..utils import logger
from . import Handler, UnfurlableUrl, UnfurledUrl

# The display modes on the frontend are defined in app/utils/discover/types.tsx
display_modes: Mapping[str, ChartType] = {
    "default": ChartType.SLACK_DISCOVER_TOTAL_PERIOD,
    "daily": ChartType.SLACK_DISCOVER_TOTAL_DAILY,
    "top5": ChartType.SLACK_DISCOVER_TOP5_PERIOD,
    "top5line": ChartType.SLACK_DISCOVER_TOP5_PERIOD_LINE,
    "dailytop5": ChartType.SLACK_DISCOVER_TOP5_DAILY,
    "previous": ChartType.SLACK_DISCOVER_PREVIOUS_PERIOD,
    "bar": ChartType.SLACK_DISCOVER_TOTAL_DAILY,
}

# All `multiPlotType: line` fields in /static/app/utils/discover/fields.tsx
line_plot_fields = {
    "count_unique",
    "failure_count",
    "min",
    "max",
    "p50",
    "p75",
    "p95",
    "p99",
    "p100",
    "percentile",
    "avg",
    "apdex",
    "user_misery",
    "failure_rate",
}

TOP_N = 5
MAX_PERIOD_DAYS_INCLUDE_PREVIOUS = 45
DEFAULT_PERIOD = "14d"
DEFAULT_AXIS_OPTION = "count()"
AGGREGATE_PATTERN = r"^(\w+)\((.*)?\)$"
AGGREGATE_BASE = r"(\w+)\((.*)?\)"


class IntervalException(Exception):
    pass


def get_double_period(period: str) -> str:
    m = re.match(r"^(\d+)([hdmsw]?)$", period)
    if not m:
        m = re.match(r"^(\d+)([hdmsw]?)$", DEFAULT_PERIOD)

    value, unit = m.groups()  # type: ignore
    value = int(value)

    return f"{value * 2}{unit}"


def get_top5_display_mode(field: str) -> str:
    if is_equation(field):
        return "top5line"

    return "top5line" if field.split("(")[0] in line_plot_fields else "top5"


def is_aggregate(field: str) -> bool:
    field_match = re.match(AGGREGATE_PATTERN, field)
    if field_match:
        return True

    equation_match = re.match(AGGREGATE_BASE, field) and is_equation(field)
    if equation_match:
        return True

    return False


def unfurl_discover(
    request: HttpRequest,
    integration: Integration,
    links: list[UnfurlableUrl],
    user: User | None = None,
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

        # If the link shared is an org w/o the slack integration do not unfurl
        if not org:
            continue
        if not features.has("organizations:discover-basic", org):
            continue

        params = link.args["query"]
        query_id = params.get("id", None)

        saved_query = {}
        if query_id:
            try:
                response = client.get(
                    auth=ApiKey(organization_id=org.id, scope_list=["org:read"]),
                    path=f"/organizations/{org_slug}/discover/saved/{query_id}/",
                )

            except Exception as exc:
                logger.error(
                    "Failed to load saved query for unfurl: %s",
                    exc,
                    exc_info=True,
                )
            else:
                saved_query = response.data

        # Override params from Discover Saved Query if they aren't in the URL
        params.setlist(
            "order",
            params.getlist("sort")
            or (to_list(saved_query["orderby"]) if saved_query.get("orderby") else []),
        )
        params.setlist("name", params.getlist("name") or to_list(saved_query.get("name")))

        fields = params.getlist("field") or to_list(saved_query.get("fields"))
        # Mimic Discover to pick the first aggregate as the yAxis option if
        # one isn't specified.
        axis_options = [field for field in fields if is_aggregate(field)] + [DEFAULT_AXIS_OPTION]
        params.setlist(
            "yAxis", params.getlist("yAxis") or to_list(saved_query.get("yAxis", axis_options[0]))
        )
        params.setlist("field", params.getlist("field") or to_list(saved_query.get("fields")))

        params.setlist(
            "project",
            params.getlist("project")
            or (to_list(saved_query.get("project")) if saved_query.get("project") else []),
        )

        # Only override if key doesn't exist since we want to account for
        # an intermediate state where the query could have been cleared
        if "query" not in params:
            params.setlist(
                "query", params.getlist("query") or to_list(saved_query.get("query", ""))
            )

        display_mode = str(params.get("display") or saved_query.get("display", "default"))

        if "top5" in display_mode:
            params.setlist(
                "topEvents",
                params.getlist("topEvents") or to_list(saved_query.get("topEvents", f"{TOP_N}")),
            )

            y_axis = params.getlist("yAxis")[0]
            if display_mode != "dailytop5":
                display_mode = get_top5_display_mode(y_axis)
            top_events = params.getlist("topEvents")[0]
        else:
            # topEvents param persists in the URL in some cases, we want to discard
            # it if it's not a top n display type.
            params.pop("topEvents", None)
            top_events = 0

        if "daily" in display_mode:
            params.setlist("interval", ["1d"])
        else:
            interval = saved_query.get("interval")
            validated_interval = None
            delta = timedelta(days=90)
            if "statsPeriod" in params:
                if (parsed_period := parse_stats_period(params["statsPeriod"])) is not None:
                    delta = parsed_period
            elif "start" in params and "end" in params:
                start, end = parse_timestamp(params["start"]), parse_timestamp(params["end"])
                if start is not None and end is not None:
                    delta = end - start
            if interval:
                try:
                    if (parsed_interval := parse_stats_period(interval)) is not None:
                        validate_interval(
                            parsed_interval,
                            IntervalException("Invalid interval"),
                            delta,
                            top_events,
                        )
                        validated_interval = interval
                except IntervalException:
                    pass
            if validated_interval is None:
                if delta:
                    validated_interval = get_interval_from_range(delta, False)
                else:
                    validated_interval = "1h"
            params.setlist("interval", [validated_interval])

        if "previous" in display_mode:
            stats_period = params.getlist("statsPeriod", [DEFAULT_PERIOD])[0]
            parsed_period = parse_stats_period(stats_period)
            if parsed_period and parsed_period <= timedelta(days=MAX_PERIOD_DAYS_INCLUDE_PREVIOUS):
                stats_period = get_double_period(stats_period)
                params.setlist("statsPeriod", [stats_period])

        endpoint = "events-stats/"

        try:
            resp = client.get(
                auth=ApiKey(organization_id=org.id, scope_list=["org:read"]),
                user=user,
                path=f"/organizations/{org_slug}/{endpoint}",
                params=params,
            )
        except Exception as exc:
            logger.error(
                f"Failed to load {endpoint} for unfurl: {exc}",
                exc_info=True,
            )
            continue

        chart_data = {"seriesName": params.get("yAxis"), "stats": resp.data}

        style = display_modes.get(display_mode, display_modes["default"])

        try:
            url = charts.generate_chart(style, chart_data)
        except RuntimeError as exc:
            logger.error(
                "Failed to generate chart for discover unfurl: %s",
                exc,
                exc_info=True,
            )
            continue

        unfurls[link.url] = SlackDiscoverMessageBuilder(
            title=link.args["query"].get("name", "Dashboards query"),
            chart_url=url,
        ).build()

    first_org_integration = org_integrations[0] if len(org_integrations) > 0 else None
    if first_org_integration is not None and hasattr(first_org_integration, "id"):
        analytics.record(
            "integrations.slack.chart_unfurl",
            organization_id=first_org_integration.organization_id,
            user_id=user.id if user else None,
            unfurls_count=len(unfurls),
        )

    return unfurls


def map_discover_query_args(url: str, args: Mapping[str, str | None]) -> Mapping[str, Any]:
    """
    Extracts discover arguments from the discover link's query string
    """
    # Slack uses HTML escaped ampersands in its Event Links, when need
    # to be unescaped for QueryDict to split properly.
    url = html.unescape(url)
    parsed_url = urlparse(url)
    query = QueryDict(parsed_url.query).copy()

    # Remove some unused query keys
    query.pop("widths", None)

    return dict(**args, query=query)


discover_link_regex = re.compile(
    r"^https?\://(?#url_prefix)[^/]+/organizations/(?P<org_slug>[^/]+)/discover/(results|homepage)"
)

customer_domain_discover_link_regex = re.compile(
    r"^https?\://(?P<org_slug>[^.]+?)\.(?#url_prefix)[^/]+/discover/(results|homepage)"
)

handler = Handler(
    fn=unfurl_discover,
    matcher=[discover_link_regex, customer_domain_discover_link_regex],
    arg_mapper=map_discover_query_args,
)
