from __future__ import annotations

import html
import logging
import re
from collections.abc import Callable, Mapping
from datetime import timedelta
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
from sentry.utils.dates import parse_stats_period, parse_timestamp

_logger = logging.getLogger(__name__)

DEFAULT_PERIOD = "14d"
TOP_N = 5

EXPLORE_CHART_SIZE: ChartSize = {"width": 1200, "height": 400}

# Mirrors the frontend's MINIMUM_INTERVAL ladder in
# static/app/utils/useChartInterval.tsx. All Explore views call
# `useChartInterval()` with the default `USE_SMALLEST` strategy, so the
# interval the UI picks when none is in the URL is exactly the value this
# ladder returns for the selected time range. Keep the thresholds and
# intervals in sync with that file so unfurled charts bucket data the same
# way as the live Explore UI.
_DEFAULT_INTERVAL_LADDER: tuple[tuple[timedelta, str], ...] = (
    (timedelta(days=30), "3h"),
    (timedelta(days=14), "1h"),
    (timedelta(days=4), "30m"),
    (timedelta(hours=48), "10m"),
    (timedelta(hours=12), "5m"),
    (timedelta(0), "1m"),
)


def _query_time_range(params: QueryDict) -> timedelta:
    """Return the selected time range, mirroring the frontend's
    `getDiffInMinutes`: prefer absolute start/end, otherwise parse statsPeriod."""
    start = params.get("start")
    end = params.get("end")
    if start and end:
        try:
            return max(parse_timestamp(end) - parse_timestamp(start), timedelta(0))
        except (ValueError, TypeError):
            pass

    period = params.get("statsPeriod") or DEFAULT_PERIOD
    parsed = parse_stats_period(period)
    return parsed if parsed is not None else timedelta(0)


def _default_interval_for_query(params: QueryDict) -> str:
    diff = _query_time_range(params)
    for threshold, interval in _DEFAULT_INTERVAL_LADDER:
        if diff >= threshold:
            return interval
    return "1m"


def _clamp_interval(url_interval: str, minimum_interval: str) -> str:
    """Match the frontend's `useChartIntervalImpl`: if the URL's explicit
    interval is finer than the minimum the ladder allows for the selected
    time range, fall back to the minimum. Stale URLs (e.g. an `interval=1m`
    pasted from a 1h view into a 7d view) would otherwise produce thousands
    of buckets that events-timeseries rejects, so the unfurl renders empty."""
    url_td = parse_stats_period(url_interval)
    minimum_td = parse_stats_period(minimum_interval)
    if url_td is None:
        return minimum_interval
    if minimum_td is not None and url_td < minimum_td:
        return minimum_interval
    return url_interval


def _aggregate_sorts_are_valid(
    sort_values: list[str], y_axes: list[str], group_bys: list[str]
) -> bool:
    # Mirrors the frontend's validateAggregateSort: drop sort if any entry
    # references a field that isn't a current yAxis or groupBy, so the unfurl
    # falls back to the default `-yAxes[0]` sort like the Explore UI does.
    valid_targets = set(y_axes) | set(group_bys)
    return all(sort_value.lstrip("-") in valid_targets for sort_value in sort_values)


def _parse_aggregate_field_json(
    field_json: str,
) -> tuple[str | None, list[str], int | None]:
    """Extract (groupBy, yAxes, chartType) from a single aggregateField/visualize entry."""
    try:
        parsed = json.loads(field_json)
    except (json.JSONDecodeError, TypeError, AttributeError):
        return None, [], None

    if not isinstance(parsed, dict):
        return None, [], None

    group_by = parsed.get("groupBy") or None
    raw_y_axes = parsed.get("yAxes")
    y_axes = list(raw_y_axes) if isinstance(raw_y_axes, list) else []
    chart_type = parsed.get("chartType") if isinstance(parsed.get("chartType"), int) else None
    return group_by, y_axes, chart_type


def _parse_aggregate_field_entries(
    entries: list[str],
) -> tuple[list[str], list[str], int | None]:
    """Walk a list of aggregateField/visualize JSON entries and collect groupBys + first yAxes."""
    y_axes: list[str] = []
    group_bys: list[str] = []
    chart_type: int | None = None
    for field_json in entries:
        group_by, parsed_y_axes, parsed_chart_type = _parse_aggregate_field_json(field_json)
        if group_by:
            group_bys.append(group_by)
        if not y_axes and parsed_y_axes:
            y_axes = parsed_y_axes
            if parsed_chart_type is not None:
                chart_type = parsed_chart_type
    return y_axes, group_bys, chart_type


def _build_timeseries_query(
    raw_query: QueryDict,
    y_axes: list[str],
    group_bys: list[str],
    query: str | None,
    sort_values: list[str],
) -> QueryDict:
    """Assemble the QueryDict that will be sent to the events-timeseries API."""
    out = QueryDict(mutable=True)
    out.setlist("yAxis", y_axes)

    if group_bys:
        out.setlist("groupBy", group_bys)

    for param in ("project", "statsPeriod", "start", "end", "environment", "interval"):
        values = raw_query.getlist(param)
        if values:
            out.setlist(param, values)

    if query:
        out["query"] = query

    if sort_values:
        out.setlist("sort", sort_values)

    if not out.get("statsPeriod") and not out.get("start"):
        out["statsPeriod"] = DEFAULT_PERIOD

    minimum_interval = _default_interval_for_query(out)
    url_interval = out.get("interval")
    out["interval"] = (
        _clamp_interval(url_interval, minimum_interval) if url_interval else minimum_interval
    )

    return out


def _parse_traces_url(raw_query: QueryDict, default_y_axis: str) -> tuple[QueryDict, int | None]:
    """Traces visualizations are stored under aggregateField, falling back to the
    legacy visualize key."""
    entries = raw_query.getlist("aggregateField") or raw_query.getlist("visualize")
    y_axes, group_bys, chart_type = _parse_aggregate_field_entries(entries)

    if not y_axes:
        y_axes = [default_y_axis]

    query_values = raw_query.getlist("query")
    query = query_values[0] if query_values else None

    sort_values = raw_query.getlist("aggregateSort")
    if sort_values and not _aggregate_sorts_are_valid(sort_values, y_axes, group_bys):
        sort_values = []

    return _build_timeseries_query(raw_query, y_axes, group_bys, query, sort_values), chart_type


def _parse_logs_url(raw_query: QueryDict, default_y_axis: str) -> tuple[QueryDict, int | None]:
    """Logs visualizations live in aggregateField; query/sort use logs-specific keys
    and sorts target table columns rather than aggregate fields, so they're not
    validated against yAxes/groupBys."""
    y_axes, group_bys, chart_type = _parse_aggregate_field_entries(
        raw_query.getlist("aggregateField")
    )

    if not y_axes:
        y_axes = [default_y_axis]

    query_values = raw_query.getlist("logsQuery")
    query = query_values[0] if query_values else None

    sort_values = raw_query.getlist("logsSortBys")

    return _build_timeseries_query(raw_query, y_axes, group_bys, query, sort_values), chart_type


def _metric_chart_is_visible(metric_parsed: dict[str, Any]) -> bool:
    """A metric renders the first aggregateField with `yAxes`. That entry's
    `visible` flag (defaulting to True) controls whether the chart is shown
    in the UI; mirror that here so hidden charts are skipped during unfurl."""
    for agg_field in metric_parsed.get("aggregateFields") or []:
        if not isinstance(agg_field, dict):
            continue
        if isinstance(agg_field.get("yAxes"), list):
            return agg_field.get("visible", True) is not False
    # No yAxes entry means we'll fall back to the dataset default, treat as visible.
    return True


def _parse_metrics_url(
    raw_query: QueryDict, default_y_axis: str
) -> tuple[QueryDict | None, int | None]:
    """Metrics encodes each chart in its own `metric` JSON param. Multiple
    metric params represent multiple charts; pick the first whose visualization
    is visible (matching the Explore UI's `visible` flag). If none are
    visible, return `None` to signal no chart should be rendered."""
    metric_list = raw_query.getlist("metric")
    if not metric_list:
        return _build_timeseries_query(raw_query, [default_y_axis], [], None, []), None

    metric_parsed: dict[str, Any] | None = None
    for raw_metric in metric_list:
        try:
            parsed = json.loads(raw_metric)
        except (json.JSONDecodeError, TypeError, AttributeError):
            continue
        if not isinstance(parsed, dict):
            continue
        if _metric_chart_is_visible(parsed):
            metric_parsed = parsed
            break

    if metric_parsed is None:
        return None, None

    y_axes: list[str] = []
    group_bys: list[str] = []
    chart_type: int | None = None
    # `or []` so a present-but-null aggregateFields/aggregateSortBys field in
    # the user-supplied metric JSON doesn't blow up iteration.
    # Metrics renders multiple aggregates (e.g. p50 + p95) as multiple series on
    # a single chart, so accumulate yAxes across every aggregateFields entry.
    for agg_field in metric_parsed.get("aggregateFields") or []:
        if not isinstance(agg_field, dict):
            continue
        if agg_field.get("groupBy"):
            group_bys.append(agg_field["groupBy"])
        if isinstance(agg_field.get("yAxes"), list):
            y_axes.extend(agg_field["yAxes"])
            if chart_type is None and isinstance(agg_field.get("chartType"), int):
                chart_type = agg_field["chartType"]

    if not y_axes:
        y_axes = [default_y_axis]

    sort_values: list[str] = []
    for sort_by in metric_parsed.get("aggregateSortBys") or []:
        if not isinstance(sort_by, dict):
            continue
        sort_field = sort_by.get("field", "")
        kind = sort_by.get("kind", "desc")
        if sort_field:
            sort_values.append(f"-{sort_field}" if kind == "desc" else sort_field)

    query = metric_parsed.get("query") or None

    return _build_timeseries_query(raw_query, y_axes, group_bys, query, sort_values), chart_type


ExploreParserFn = Callable[[QueryDict, str], tuple[QueryDict | None, int | None]]


class ExploreDatasetConfig(TypedDict):
    title_prefix: str
    default_y_axis: str
    parse_url_fn: ExploreParserFn


EXPLORE_DATASET_CONFIGS: dict[SupportedTraceItemType, ExploreDatasetConfig] = {
    SupportedTraceItemType.SPANS: {
        "title_prefix": "Explore Traces",
        "default_y_axis": "count(span.duration)",
        "parse_url_fn": _parse_traces_url,
    },
    SupportedTraceItemType.LOGS: {
        "title_prefix": "Explore Logs",
        "default_y_axis": "count(message)",
        "parse_url_fn": _parse_logs_url,
    },
    SupportedTraceItemType.TRACEMETRICS: {
        "title_prefix": "Explore Metrics",
        "default_y_axis": "sum(value)",
        "parse_url_fn": _parse_metrics_url,
    },
}


def _get_explore_dataset_config(dataset: SupportedTraceItemType) -> ExploreDatasetConfig:
    """Returns the config for the given explore dataset."""
    return EXPLORE_DATASET_CONFIGS.get(
        dataset, EXPLORE_DATASET_CONFIGS[SupportedTraceItemType.SPANS]
    )


def _get_explore_dataset(url: str) -> SupportedTraceItemType:
    """Returns the dataset based on the explore URL."""
    if explore_logs_link_regex.match(url) or customer_domain_explore_logs_link_regex.match(url):
        return SupportedTraceItemType.LOGS
    if explore_metrics_link_regex.match(url) or customer_domain_explore_metrics_link_regex.match(
        url
    ):
        return SupportedTraceItemType.TRACEMETRICS
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
        if params is None:
            # Parser signaled no chart should be rendered (e.g. all metrics
            # in the URL are hidden).
            continue
        chart_type = link.args.get("chart_type")

        explore_dataset = link.args.get("dataset", SupportedTraceItemType.SPANS)
        dataset_config = _get_explore_dataset_config(explore_dataset)

        y_axes = params.getlist("yAxis")
        if not y_axes:
            y_axes = [dataset_config["default_y_axis"]]
            params.setlist("yAxis", y_axes)

        group_bys = params.getlist("groupBy")

        style = ChartType.SLACK_TIMESERIES
        if group_bys:
            params.setlist("topEvents", [str(TOP_N)])
            if not params.getlist("sort"):
                # Default to descending by the first yAxis, matching Explore's
                # defaultAggregateSortBys behavior
                params.setlist("sort", [f"-{y_axes[0]}"])

        params["dataset"] = explore_dataset.value
        params["referrer"] = Referrer.EXPLORE_SLACK_UNFURL.value

        # ApiClient iterates params via .items(), which collapses multi-value
        # QueryDict keys to the last value. Walk lists() and emit a real list
        # for multi-value keys (e.g. multiple groupBy entries from aggregateField)
        # so all values reach events-timeseries.
        api_params: dict[str, str | list[str]] = {
            key: values if len(values) > 1 else values[0] for key, values in params.lists()
        }

        try:
            resp = client.get(
                auth=ApiKey(organization_id=org.id, scope_list=["org:read"]),
                user=user,
                path=f"/organizations/{org_slug}/events-timeseries/",
                params=api_params,
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
        title = f"{dataset_config['title_prefix']} - {y_axes[0]}"
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
    """Extract explore arguments from the explore link's query string.

    Dispatches to the per-dataset parser registered on the dataset's config to
    produce the timeseries query dict.
    """
    # Slack uses HTML escaped ampersands in its Event Links
    url = html.unescape(url)
    parsed_url = urlparse(url)
    raw_query = QueryDict(parsed_url.query)

    explore_dataset = _get_explore_dataset(url)
    config = _get_explore_dataset_config(explore_dataset)

    query, chart_type = config["parse_url_fn"](raw_query, config["default_y_axis"])

    return dict(**args, query=query, chart_type=chart_type, dataset=explore_dataset)


explore_traces_link_regex = re.compile(
    r"^https?\://(?#url_prefix)[^/]+/organizations/(?P<org_slug>[^/]+)/explore/traces/(?=[?#]|$)"
)

customer_domain_explore_traces_link_regex = re.compile(
    r"^https?\://(?P<org_slug>[^.]+?)\.(?#url_prefix)[^/]+/explore/traces/(?=[?#]|$)"
)

explore_logs_link_regex = re.compile(
    r"^https?\://(?#url_prefix)[^/]+/organizations/(?P<org_slug>[^/]+)/explore/logs/(?=[?#]|$)"
)

customer_domain_explore_logs_link_regex = re.compile(
    r"^https?\://(?P<org_slug>[^.]+?)\.(?#url_prefix)[^/]+/explore/logs/(?=[?#]|$)"
)

explore_metrics_link_regex = re.compile(
    r"^https?\://(?#url_prefix)[^/]+/organizations/(?P<org_slug>[^/]+)/explore/metrics/(?=[?#]|$)"
)

customer_domain_explore_metrics_link_regex = re.compile(
    r"^https?\://(?P<org_slug>[^.]+?)\.(?#url_prefix)[^/]+/explore/metrics/(?=[?#]|$)"
)

explore_handler = Handler(
    fn=unfurl_explore,
    matcher=[
        explore_traces_link_regex,
        customer_domain_explore_traces_link_regex,
        explore_logs_link_regex,
        customer_domain_explore_logs_link_regex,
        explore_metrics_link_regex,
        customer_domain_explore_metrics_link_regex,
    ],
    arg_mapper=map_explore_query_args,
)
