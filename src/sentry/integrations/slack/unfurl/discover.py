import html
import re
from datetime import timedelta
from typing import Any, List, Mapping, Optional
from urllib.parse import urlparse

from django.http.request import HttpRequest, QueryDict

from sentry import analytics, features
from sentry.api import client
from sentry.charts import generate_chart
from sentry.charts.types import ChartType
from sentry.integrations.slack.message_builder.discover import build_discover_attachment
from sentry.models import ApiKey, Integration
from sentry.models.user import User
from sentry.search.events.filter import to_list
from sentry.utils.dates import parse_stats_period

from ..utils import logger
from . import Handler, UnfurlableUrl, UnfurledUrl

# The display modes on the frontend are defined in app/utils/discover/types.tsx
display_modes: Mapping[str, ChartType] = {
    "default": ChartType.SLACK_DISCOVER_TOTAL_PERIOD,
    "daily": ChartType.SLACK_DISCOVER_TOTAL_DAILY,
    "top5": ChartType.SLACK_DISCOVER_TOP5_PERIOD,
    "dailytop5": ChartType.SLACK_DISCOVER_TOP5_DAILY,
    "previous": ChartType.SLACK_DISCOVER_PREVIOUS_PERIOD,
}

TOP_N = 5
MAX_PERIOD_DAYS_INCLUDE_PREVIOUS = 45
DEFAULT_PERIOD = "14d"


def get_double_period(period: str) -> str:
    m = re.match(r"^(\d+)([hdmsw]?)$", period)
    if not m:
        m = re.match(r"^(\d+)([hdmsw]?)$", DEFAULT_PERIOD)

    value, unit = m.groups()  # type: ignore
    value = int(value)

    return f"{value * 2}{unit}"


def unfurl_discover(
    data: HttpRequest,
    integration: Integration,
    links: List[UnfurlableUrl],
    user: Optional["User"],
) -> UnfurledUrl:
    orgs_by_slug = {org.slug: org for org in integration.organizations.all()}
    unfurls = {}

    for link in links:
        org_slug = link.args["org_slug"]
        org = orgs_by_slug.get(org_slug)

        # If the link shared is an org w/o the slack integration do not unfurl
        if not org:
            continue
        if not features.has("organizations:chart-unfurls", org):
            continue

        params = link.args["query"]
        query_id = params.get("id", None)

        saved_query = {}
        if query_id:
            try:
                response = client.get(
                    auth=ApiKey(organization=org, scope_list=["org:read"]),
                    path=f"/organizations/{org_slug}/discover/saved/{query_id}/",
                )

            except Exception as exc:
                logger.error(
                    "Failed to load saved query for unfurl: %s",
                    str(exc),
                    exc_info=True,
                )
            else:
                saved_query = response.data

        # Override params from Discover Saved Query if they aren't in the URL
        params.setlist(
            "order",
            params.getlist("sort")
            or (to_list(saved_query.get("orderby")) if saved_query.get("orderby") else []),
        )
        params.setlist("name", params.getlist("name") or to_list(saved_query.get("name")))
        params.setlist(
            "yAxis", params.getlist("yAxis") or to_list(saved_query.get("yAxis", "count()"))
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
            params.setlist("query", params.getlist("query") or to_list(saved_query.get("query")))

        display_mode = str(params.get("display") or saved_query.get("display", "default"))

        if "daily" in display_mode:
            params.setlist("interval", ["1d"])

        if "top5" in display_mode:
            if features.has("organizations:discover-top-events", org):
                params.setlist(
                    "topEvents",
                    params.getlist("topEvents")
                    or to_list(saved_query.get("topEvents", f"{TOP_N}")),
                )
            else:
                params.setlist("topEvents", [f"{TOP_N}"])
        else:
            # topEvents param persists in the URL in some cases, we want to discard
            # it if it's not a top n display type.
            params.pop("topEvents", None)

        if "previous" in display_mode:
            stats_period = params.getlist("statsPeriod", [DEFAULT_PERIOD])[0]
            parsed_period = parse_stats_period(stats_period)
            if parsed_period and parsed_period <= timedelta(days=MAX_PERIOD_DAYS_INCLUDE_PREVIOUS):
                stats_period = get_double_period(stats_period)
                params.setlist("statsPeriod", [stats_period])

        try:
            resp = client.get(
                auth=ApiKey(organization=org, scope_list=["org:read"]),
                user=user,
                path=f"/organizations/{org_slug}/events-stats/",
                params=params,
            )
        except Exception as exc:
            logger.error(
                "Failed to load events-stats for unfurl: %s",
                str(exc),
                exc_info=True,
            )
            continue

        chart_data = {"seriesName": params.get("yAxis"), "stats": resp.data}

        style = display_modes.get(display_mode, display_modes["default"])

        try:
            url = generate_chart(style, chart_data)
        except RuntimeError as exc:
            logger.error(
                "Failed to generate chart for discover unfurl: %s",
                str(exc),
                exc_info=True,
            )
            continue

        unfurls[link.url] = build_discover_attachment(
            title=link.args["query"].get("name", "Dashboards query"),
            chart_url=url,
        )

    analytics.record(
        "integrations.slack.chart_unfurl",
        organization_id=integration.organizations.all()[0].id,
        user_id=user.id if user else None,
        unfurls_count=len(unfurls),
    )

    return unfurls


def map_discover_query_args(url: str, args: Mapping[str, str]) -> Mapping[str, Any]:
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


handler: Handler = Handler(
    fn=unfurl_discover,
    matcher=re.compile(r"^https?\://[^/]+/organizations/(?P<org_slug>[^/]+)/discover/results"),
    arg_mapper=map_discover_query_args,
)
