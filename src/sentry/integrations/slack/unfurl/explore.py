from __future__ import annotations

import html
import logging
import re
from collections.abc import Callable, Mapping
from datetime import timedelta
from typing import Any, NamedTuple, TypedDict
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
from sentry.search.eap.constants import VALID_GRANULARITIES
from sentry.search.eap.types import SupportedTraceItemType
from sentry.search.events.constants import DURATION_UNITS, PERCENT_UNITS, SIZE_UNITS
from sentry.search.events.fields import is_function, parse_arguments
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


# Heat Map unfurls always render to a fixed Chartcuterie canvas. We pick the
# X-axis interval to target ~150 columns; the actual column count varies because
# we're limited to a known set of intervals. The Y-axis bucket count is then
# derived geometrically from that column width (see `_heatmap_y_buckets`) so
# cells render square regardless of how the interval quantization landed,
# falling back to `HEATMAP_FALLBACK_Y_BUCKETS` when the geometry is undefined.
HEATMAP_TARGET_X_BUCKETS = 150
# Fallback Y-axis bucket count for degenerate time ranges. 50 over the 400px
# canvas gives ~8px cells.
HEATMAP_FALLBACK_Y_BUCKETS = 50


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


def _interval_for_query(params: QueryDict) -> str:
    """Pick the interval the ladder assigns to the query's time range, mirroring
    the frontend's ``GranularityLadder.getInterval``."""
    diff = _query_time_range(params)
    for threshold, interval in _DEFAULT_INTERVAL_LADDER:
        if diff >= threshold:
            return interval
    return "1m"


def _heatmap_interval(time_range: timedelta) -> str:
    """Pick the finest backend-supported granularity that keeps the Heat Map
    within ``HEATMAP_TARGET_X_BUCKETS`` columns, so it renders a fixed-density
    grid sized to the Chartcuterie canvas regardless of the selected time range.
    Iterates the EAP-accepted ``VALID_GRANULARITIES`` (the only dataset we
    support for Heat Map widgets is trace metrics)."""
    seconds = time_range.total_seconds()
    for granularity in sorted(VALID_GRANULARITIES):
        if seconds / granularity <= HEATMAP_TARGET_X_BUCKETS:
            return f"{granularity}s"
    return f"{max(VALID_GRANULARITIES)}s"


def _heatmap_y_buckets(time_range: timedelta, interval: str) -> int | None:
    """Derive the Y-axis bucket count that makes Heat Map cells square on the
    fixed Chartcuterie canvas: the X column width in px is
    ``(interval / time_range) * width``, and we pick the Y bucket count whose
    cell height matches it. Returns ``None`` when the geometry is undefined
    (empty time range / interval) so the caller can fall back to a default.
    Mirrors the frontend's ``calculateHeatMapBucketDimensions``."""
    total = time_range.total_seconds()
    interval_td = parse_stats_period(interval)
    interval_seconds = interval_td.total_seconds() if interval_td else 0
    if total <= 0 or interval_seconds <= 0:
        return None
    x_columns = total / interval_seconds
    column_width_px = EXPLORE_CHART_SIZE["width"] / x_columns
    square_buckets = round(EXPLORE_CHART_SIZE["height"] / column_width_px)
    # Clamp to [1 row, one row per vertical pixel]. The lower bound covers the
    # single-column case; the upper bound keeps very long ranges from requesting
    # sub-pixel rows (and blowing past the events-heatmap yBuckets cap).
    return max(1, min(square_buckets, EXPLORE_CHART_SIZE["height"]))


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


def _build_heatmap_query(raw_query: QueryDict) -> QueryDict:
    """Assemble the QueryDict sent to the events-heatmap API. Like
    ``_build_timeseries_query`` but adds the heatmap params (xAxis/yAxis/zAxis/
    yBuckets). The URL interval is ignored; instead we pick the interval that
    targets `HEATMAP_TARGET_X_BUCKETS` columns and derive `yBuckets`
    geometrically so cells render square on the Chartcuterie canvas."""
    out = QueryDict(mutable=True)

    for param in ("project", "statsPeriod", "start", "end", "environment"):
        values = raw_query.getlist(param)
        if values:
            out.setlist(param, values)

    # The heat map plots the generic `value`, so scope the metric via the query
    # filter (mirroring createTraceMetricEventsFilter), ANDed with the user query.
    y_axes = raw_query.getlist("yAxis")
    trace_metric = _trace_metric_from_aggregate(y_axes[0]) if y_axes else None
    metric_filter = _create_trace_metric_events_filter(*trace_metric) if trace_metric else None

    user_query = raw_query.get("query")
    if metric_filter and user_query:
        out["query"] = f"{metric_filter} ({user_query})"
    elif metric_filter:
        out["query"] = metric_filter
    elif user_query:
        out["query"] = user_query

    if not out.get("statsPeriod") and not out.get("start"):
        out["statsPeriod"] = DEFAULT_PERIOD

    time_range = _query_time_range(out)
    interval = _heatmap_interval(time_range)
    out["interval"] = interval
    y_buckets = _heatmap_y_buckets(time_range, interval)
    out["yBuckets"] = str(y_buckets if y_buckets is not None else HEATMAP_FALLBACK_Y_BUCKETS)

    # Fixed axes — the endpoint currently only supports these values.
    out["xAxis"] = "time"
    out["yAxis"] = "value"
    out["zAxis"] = "count()"
    out["dataset"] = "tracemetrics"
    out["referrer"] = Referrer.EXPLORE_SLACK_UNFURL.value

    return out


def _map_metric_unit_to_field_type(metric_unit: str | None) -> tuple[str, str | None]:
    """Port of the frontend's ``mapMetricUnitToFieldType``: map a metric unit to the
    ``(valueType, valueUnit)`` the renderer formats with. Unknown/absent -> number."""
    if not metric_unit or metric_unit == "-":
        return "number", None
    if metric_unit in DURATION_UNITS:
        return "duration", metric_unit
    if metric_unit in SIZE_UNITS:
        return "size", metric_unit
    if metric_unit in PERCENT_UNITS:
        return "percentage", metric_unit
    return "number", None


class TraceMetric(NamedTuple):
    name: str
    type: str
    unit: str | None


def _trace_metric_from_aggregate(aggregate: str) -> TraceMetric | None:
    """Parse ``(name, type, unit)`` from a trace metric aggregate like
    ``aggregate(value,name,type,unit)``; ``None`` for non-metric aggregates (e.g.
    ``sum(value)``). Mirrors ``parseMetricAggregate``, reusing ``parse_arguments``."""
    match = is_function(aggregate)
    if match is None:
        return None
    function = match.group("function")
    args = parse_arguments(function, match.group("columns"))
    # Drop the leading conditional query (for `_if`) and the `value` attribute.
    metric_args = args[(1 if function.endswith("_if") else 0) + 1 :]
    if len(metric_args) < 2 or not metric_args[0] or not metric_args[1]:
        return None
    unit = metric_args[2] if len(metric_args) >= 3 else None
    return TraceMetric(name=metric_args[0], type=metric_args[1], unit=unit)


def _create_trace_metric_events_filter(name: str, metric_type: str, unit: str | None) -> str:
    """Port of the frontend's ``createTraceMetricEventsFilter``: the search filter
    scoping a heat map query to one metric. A missing unit (``None``/``-``) matches
    unit-less items and the ``none`` sentinel."""
    none_unit = "none"
    normalized_unit = unit if unit and unit != "-" else none_unit
    clauses = [f"metric.name:{name}", f"metric.type:{metric_type}"]
    if normalized_unit == none_unit:
        clauses.append("( !has:metric.unit OR metric.unit:none )")
    else:
        clauses.append(f"metric.unit:{normalized_unit}")
    return "( " + " ".join(clauses) + " )"


def _merge_metric_unit(heatmap_data: dict[str, Any], metric_unit: str | None) -> dict[str, Any]:
    """Port of the frontend's ``mergeMetricUnit``. The events-heatmap API returns the
    Y axis as the generic ``value`` with no unit, so patch the meta with the metric's
    unit/type to format values (ms, bytes) instead of raw numbers."""
    field_type, unit = _map_metric_unit_to_field_type(metric_unit)
    if unit is None:
        return heatmap_data
    meta = heatmap_data.get("meta")
    if not isinstance(meta, dict):
        return heatmap_data
    y_axis = meta.get("yAxis")
    if not isinstance(y_axis, dict):
        return heatmap_data
    return {
        **heatmap_data,
        "meta": {
            **meta,
            "yAxis": {
                **y_axis,
                "valueType": field_type,
                "valueUnit": unit,
            },
        },
    }


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

    minimum_interval = _interval_for_query(out)
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
    """Logs visualizations live in aggregateField. The chart's topEvents sort
    comes from `logsAggregateSortBys` (the aggregate-mode chart sort) — not
    `logsSortBys`, which is the samples-mode logs table sort (typically
    `-timestamp`) and would feed events-timeseries a non-aggregate sort field
    in topEvents mode, returning no data. Validate the aggregate sort against
    the active yAxes/groupBys like the traces parser, otherwise fall back to
    the default `-yAxes[0]` topEvents sort."""
    y_axes, group_bys, chart_type = _parse_aggregate_field_entries(
        raw_query.getlist("aggregateField")
    )

    if not y_axes:
        y_axes = [default_y_axis]

    query_values = raw_query.getlist("logsQuery")
    query = query_values[0] if query_values else None

    sort_values = raw_query.getlist("logsAggregateSortBys")
    if sort_values and not _aggregate_sorts_are_valid(sort_values, y_axes, group_bys):
        sort_values = []

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

    # A stale aggregateSortBys (e.g. left over from a previous yAxis or referencing
    # a different metric than the one being visualized) should be dropped so the
    # unfurl falls back to the default `-yAxes[0]` topEvents sort, matching the
    # frontend's validateAggregateSort.
    if sort_values and not _aggregate_sorts_are_valid(sort_values, y_axes, group_bys):
        sort_values = []

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

    enabled_orgs = {
        slug: org
        for slug, org in orgs_by_slug.items()
        if features.has("organizations:visibility-explore-view", org, actor=user)
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

        display_type = _resolve_display_type(chart_type, y_axes)
        if display_type not in SUPPORTED_DISPLAY_TYPES:
            continue

        if display_type == "heatmap":
            # Heat maps are a metrics-only visualization (events-heatmap with
            # metric-style axes). Traces/logs never offer chartType 3 in the UI,
            # but guard against hand-built URLs by skipping any non-metrics dataset.
            if explore_dataset != SupportedTraceItemType.TRACEMETRICS:
                continue

            style = ChartType.SLACK_HEATMAP
            heatmap_params = _build_heatmap_query(params)
            api_params: dict[str, str | list[str]] = {
                key: values if len(values) > 1 else values[0]
                for key, values in heatmap_params.lists()
            }

            try:
                resp = client.get(
                    auth=ApiKey(organization_id=org.id, scope_list=["org:read"]),
                    user=user,
                    path=f"/organizations/{org_slug}/events-heatmap/",
                    params=api_params,
                )
            except Exception:
                _logger.warning("Failed to load events-heatmap for explore unfurl")
                continue

            # The endpoint returns a non-HeatMapSeries shape ({"heatmap": []}) when
            # there are no projects/results; skip rather than render it.
            heatmap_data = resp.data
            if not isinstance(heatmap_data, dict) or "meta" not in heatmap_data:
                continue

            # Patch the unit-less `value` Y axis with the metric's unit (mergeMetricUnit).
            heatmap_metric = _trace_metric_from_aggregate(y_axes[0]) if y_axes else None
            metric_unit = heatmap_metric.unit if heatmap_metric else None
            chart_data: dict[str, Any] = {"heatmap": _merge_metric_unit(heatmap_data, metric_unit)}
        else:
            style = ChartType.SLACK_TIMESERIES
            group_bys = params.getlist("groupBy")
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
            api_params = {
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

            chart_data = {
                "timeSeries": resp.data.get("timeSeries", []),
                "type": display_type,
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
    3: "heatmap",
}

# Display types the Slack timeseries renderer can produce. Any chartType that
# resolves outside this set (e.g. histogram) should not unfurl, since
# rendering it as a line chart would be misleading.
SUPPORTED_DISPLAY_TYPES = frozenset({"bar", "line", "area", "heatmap"})

# Aggregates that default to bar charts in Explore's determineDefaultChartType.
# All other aggregates default to line.
_BAR_AGGREGATES = {"count", "count_unique", "sum"}


def _resolve_display_type(chart_type: int | None, y_axes: list[str]) -> str | None:
    """Return the display type string for the chart, or ``None`` when the
    URL's chartType isn't recognized.

    Uses the explicit chartType from the URL when present, otherwise mirrors
    the frontend's ``determineDefaultChartType`` logic which maps
    count/count_unique/sum aggregates to bar and everything else to line.
    The caller decides whether the resolved type is renderable (see
    ``SUPPORTED_DISPLAY_TYPES``).
    """
    if chart_type is not None:
        return CHART_TYPE_TO_DISPLAY_TYPE.get(chart_type)

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
