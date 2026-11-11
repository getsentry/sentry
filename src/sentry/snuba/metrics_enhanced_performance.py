from __future__ import annotations

import types
from collections.abc import Sequence
from datetime import timedelta
from typing import Any, Literal, cast

import sentry_sdk
from snuba_sdk import Column, Condition

from sentry.models.organization import Organization
from sentry.search.events.types import EventsResponse, SnubaParams
from sentry.snuba import discover, transactions
from sentry.snuba.metrics.extraction import MetricSpecType
from sentry.snuba.query_sources import QuerySource
from sentry.snuba.types import DatasetQuery
from sentry.utils.snuba import SnubaTSResult

# Compatibility for legacy metrics dataset names using indexed event data.
DATASET_REASON = "generic metrics performance queries are disabled"


def query(
    selected_columns: list[str],
    query: str,
    snuba_params: SnubaParams,
    equations: list[str] | None = None,
    orderby: list[str] | None = None,
    offset: int | None = None,
    limit: int = 50,
    auto_fields: bool = False,
    auto_aggregations: bool = False,
    include_equation_fields: bool = False,
    allow_metric_aggregates: bool = False,
    use_aggregate_conditions: bool = False,
    conditions: list[Condition] | None = None,
    functions_acl: list[str] | None = None,
    transform_alias_to_input_format: bool = False,
    sample: float | None = None,
    has_metrics: bool = False,
    skip_tag_resolution: bool = False,
    extra_columns: list[Column] | None = None,
    on_demand_metrics_enabled: bool = False,
    on_demand_metrics_type: MetricSpecType | None = None,
    fallback_to_transactions: bool = False,
    query_source: QuerySource | None = None,
    *,
    referrer: str,
) -> EventsResponse:
    dataset_query: DatasetQuery = discover.query
    if fallback_to_transactions:
        dataset_query = transactions.query
        sentry_sdk.set_tag("performance.dataset", "transactions")
        sentry_sdk.set_attribute("performance.dataset", "transactions")
    else:
        sentry_sdk.set_tag("performance.dataset", "discover")
        sentry_sdk.set_attribute("performance.dataset", "discover")
    results = dataset_query(
        selected_columns,
        query,
        snuba_params=snuba_params,
        equations=equations,
        orderby=orderby,
        offset=offset,
        limit=limit,
        referrer=referrer,
        auto_fields=auto_fields,
        auto_aggregations=auto_aggregations,
        use_aggregate_conditions=use_aggregate_conditions,
        conditions=conditions,
        functions_acl=functions_acl,
        transform_alias_to_input_format=transform_alias_to_input_format,
        has_metrics=has_metrics,
        query_source=query_source,
    )
    results["meta"]["isMetricsData"] = False
    results["meta"]["isMetricsExtractedData"] = False
    results["meta"]["datasetReason"] = DATASET_REASON

    return results


def timeseries_query(
    selected_columns: Sequence[str],
    query: str,
    snuba_params: SnubaParams,
    rollup: int,
    referrer: str,
    zerofill_results: bool = True,
    allow_metric_aggregates: bool = True,
    comparison_delta: timedelta | None = None,
    functions_acl: list[str] | None = None,
    has_metrics: bool = True,
    on_demand_metrics_enabled: bool = False,
    on_demand_metrics_type: MetricSpecType | None = None,
    query_source: QuerySource | None = None,
    fallback_to_transactions: bool = False,
    transform_alias_to_input_format: bool = False,
) -> SnubaTSResult:
    dataset: types.ModuleType = discover
    if fallback_to_transactions:
        dataset = transactions
        sentry_sdk.set_tag("performance.dataset", "transactions")
        sentry_sdk.set_attribute("performance.dataset", "transactions")
    else:
        sentry_sdk.set_tag("performance.dataset", "discover")
        sentry_sdk.set_attribute("performance.dataset", "discover")
    return cast(
        "SnubaTSResult",
        dataset.timeseries_query(
            selected_columns,
            query,
            snuba_params,
            rollup=rollup,
            referrer=referrer,
            zerofill_results=zerofill_results,
            comparison_delta=comparison_delta,
            functions_acl=functions_acl,
            has_metrics=has_metrics,
            query_source=query_source,
            transform_alias_to_input_format=transform_alias_to_input_format,
        ),
    )


def top_events_timeseries(
    timeseries_columns: list[str],
    selected_columns: list[str],
    user_query: str,
    snuba_params: SnubaParams,
    orderby: list[str],
    rollup: int,
    limit: int,
    organization: Organization,
    equations: list[str] | None = None,
    top_events: EventsResponse | None = None,
    allow_empty: bool = True,
    zerofill_results: bool = True,
    include_other: bool = False,
    functions_acl: list[str] | None = None,
    on_demand_metrics_enabled: bool = False,
    on_demand_metrics_type: MetricSpecType | None = None,
    query_source: QuerySource | None = None,
    fallback_to_transactions: bool = False,
    transform_alias_to_input_format: bool = False,
    *,
    referrer: str,
) -> SnubaTSResult | dict[str, Any]:
    dataset: types.ModuleType = discover
    if fallback_to_transactions:
        dataset = transactions
        sentry_sdk.set_tag("performance.dataset", "transactions")
        sentry_sdk.set_attribute("performance.dataset", "transactions")
    else:
        sentry_sdk.set_tag("performance.dataset", "discover")
        sentry_sdk.set_attribute("performance.dataset", "discover")
    return cast(
        "SnubaTSResult | dict[str, Any]",
        dataset.top_events_timeseries(
            timeseries_columns,
            selected_columns,
            user_query,
            snuba_params,
            orderby,
            rollup,
            limit,
            organization,
            equations,
            top_events,
            allow_empty,
            zerofill_results,
            include_other,
            functions_acl,
            query_source=query_source,
            transform_alias_to_input_format=transform_alias_to_input_format,
            referrer=referrer,
        ),
    )


def histogram_query(
    fields: list[str],
    user_query: str,
    snuba_params: SnubaParams,
    num_buckets: int,
    precision: int = 0,
    min_value: float | None = None,
    max_value: float | None = None,
    data_filter: Literal["exclude_outliers"] | None = None,
    group_by: list[str] | None = None,
    order_by: list[str] | None = None,
    limit_by: list[str] | None = None,
    histogram_rows: int | None = None,
    extra_conditions: list[Condition] | None = None,
    normalize_results: bool = True,
    on_demand_metrics_enabled: bool = False,
    on_demand_metrics_type: MetricSpecType | None = None,
    query_source: QuerySource | None = None,
    *,
    referrer: str,
) -> dict[str, object] | EventsResponse:
    sentry_sdk.set_tag("performance.dataset", "discover")
    sentry_sdk.set_attribute("performance.dataset", "discover")
    return discover.histogram_query(
        fields,
        user_query,
        snuba_params,
        num_buckets,
        precision,
        min_value,
        max_value,
        data_filter,
        group_by,
        order_by,
        limit_by,
        histogram_rows,
        extra_conditions,
        normalize_results,
        query_source=query_source,
        referrer=referrer,
    )
