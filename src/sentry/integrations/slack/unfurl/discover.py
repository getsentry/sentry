import re
from typing import Any, List, Mapping
from urllib.parse import urlparse

from django.http.request import QueryDict

from sentry import features
from sentry.api import client
from sentry.charts import generate_chart
from sentry.charts.types import ChartType
from sentry.integrations.slack.message_builder.discover import build_discover_attachment
from sentry.integrations.slack.utils import logger
from sentry.models import ApiKey

from . import Handler, UnfurlableUrl, UnfurledUrl

# The display modes on the frontend are defined in app/utils/discover/types.tsx
display_modes: Mapping[str, ChartType] = {
    "default": ChartType.SLACK_DISCOVER_TOTAL_PERIOD,
    "daily": ChartType.SLACK_DISCOVER_TOTAL_DAILY,
    "top5": ChartType.SLACK_DISCOVER_TOP5_PERIOD,
    "dailytop5": ChartType.SLACK_DISCOVER_TOP5_DAILY,
    # TODO(epurkhiser): Previous period
}

TOP_N = 5


def unfurl_discover(data, integration, links: List[UnfurlableUrl]) -> UnfurledUrl:
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
        params.setlist("order", params.get("sort"))
        display_mode = str(link.args["query"].get("display", "default"))

        if "daily" in display_mode:
            params.setlist("interval", ["1d"])
        if "top5" in display_mode:
            params.setlist("topEvents", [f"{TOP_N}"])

        try:
            resp = client.get(
                auth=ApiKey(organization=org, scope_list=["org:read"]),
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

        chart_data = {"seriesName": link.args["query"].get("yAxis", "count()"), "stats": resp.data}

        style = display_modes.get(display_mode, display_modes["default"])

        try:
            url = generate_chart(style, chart_data)
        except RuntimeError as exc:
            logger.error(
                "Failed to generate chat for discover unfurl: %s",
                str(exc),
                exc_info=True,
            )
            continue

        unfurls[link.url] = build_discover_attachment(
            title=link.args["query"].get("name", "Dashboards query"),
            chart_url=url,
        )

    return unfurls


def map_discover_query_args(url: str, args: Mapping[str, str]) -> Mapping[str, Any]:
    """
    Extracts discover arguments from the discover link's query string
    """
    parsed_url = urlparse(url)
    query = QueryDict(parsed_url.query).copy()

    # Remove some unused query keys
    query.pop("widths", None)

    return dict(**args, query=query)


handler = Handler(
    fn=unfurl_discover,
    matcher=re.compile(r"^https?\://[^/]+/organizations/(?P<org_slug>[^/]+)/discover/results"),
    arg_mapper=map_discover_query_args,
)
