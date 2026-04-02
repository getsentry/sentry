from __future__ import annotations

import html
import itertools
import logging
import re
from collections.abc import Mapping
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlparse

from django.http.request import QueryDict

from sentry import analytics, features
from sentry.api.serializers.snuba import calculate_time_frame, zerofill
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
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.utils import json
from sentry.utils.dates import get_interval_from_range, parse_stats_period, parse_timestamp
from sentry.utils.snuba import SnubaTSResult

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
}

TOP_N = 5


def snuba_ts_result_to_event_stats(result: SnubaTSResult, column: str) -> dict[str, Any]:
    """
    Converts a SnubaTSResult into the events-stats response format that
    Chartcuterie expects.
    """
    data = [
        (key, list(group))
        for key, group in itertools.groupby(result.data["data"], key=lambda r: r["time"])
    ]
    rv = []
    for k, v in data:
        row = [{"count": r.get(column, 0)} for r in v]
        rv.append((k, row))

    res: dict[str, Any] = {
        "data": zerofill(rv, result.start, result.end, result.rollup),
        "isMetricsData": result.data.get("isMetricsData", False),
    }

    timeframe = calculate_time_frame(result.start, result.end, result.rollup)
    res["start"] = timeframe["start"]
    res["end"] = timeframe["end"]

    return res


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

        group_bys = params.getlist("field")

        # Determine display mode based on whether groupBy is present
        if group_bys:
            y_axis = y_axes[0]
            aggregate_fn = y_axis.split("(")[0]
            if aggregate_fn in LINE_PLOT_FIELDS:
                style = ChartType.SLACK_DISCOVER_TOP5_PERIOD_LINE
            else:
                style = ChartType.SLACK_DISCOVER_TOP5_PERIOD
        else:
            style = ChartType.SLACK_DISCOVER_TOTAL_PERIOD

        # Compute time range
        now = datetime.now(tz=timezone.utc)
        stats_period = params.get("statsPeriod")
        start_param = params.get("start")
        end_param = params.get("end")

        if stats_period:
            parsed_period = parse_stats_period(stats_period)
            if parsed_period is not None:
                delta = parsed_period
            else:
                delta = timedelta(days=14)
            end = now
            start = end - delta
        elif start_param and end_param:
            parsed_start = parse_timestamp(start_param)
            parsed_end = parse_timestamp(end_param)
            if parsed_start is not None and parsed_end is not None:
                start = parsed_start
                end = parsed_end
                delta = end - start
            else:
                delta = timedelta(days=14)
                end = now
                start = end - delta
        else:
            delta = timedelta(days=14)
            end = now
            start = end - delta

        rollup = get_interval_from_range(delta, False)
        parsed_rollup = parse_stats_period(rollup)
        granularity_secs = int(parsed_rollup.total_seconds()) if parsed_rollup else 3600

        # Resolve project IDs
        project_ids = [int(p) for p in params.getlist("project") if p]
        if project_ids:
            projects = list(
                Project.objects.filter(organization=org, id__in=project_ids).values_list(
                    "id", flat=True
                )
            )
        else:
            projects = list(
                Project.objects.filter(organization=org).values_list("id", flat=True)[:10]
            )

        snuba_params = SnubaParams(
            start=start,
            end=end,
            granularity_secs=granularity_secs,
            organization=org,
            projects=Project.objects.filter(id__in=projects),
            environments=[],
        )

        query_string = params.get("query", "")

        config = SearchResolverConfig(
            auto_fields=False,
            use_aggregate_conditions=True,
        )

        try:
            result = Spans.run_timeseries_query(
                params=snuba_params,
                query_string=query_string,
                y_axes=y_axes,
                referrer=Referrer.EXPLORE_SLACK_UNFURL.value,
                config=config,
                sampling_mode=None,
            )
        except Exception:
            _logger.warning("Failed to load timeseries data for explore unfurl")
            continue

        stats = snuba_ts_result_to_event_stats(result, y_axes[0])
        chart_data = {"seriesName": y_axes[0], "stats": stats}

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

    # Build query params
    query = QueryDict(mutable=True)
    query.setlist("yAxis", y_axes)

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
