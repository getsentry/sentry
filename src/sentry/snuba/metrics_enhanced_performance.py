from __future__ import annotations

import types
from collections.abc import Sequence
from datetime import timedelta
from typing import Any

import sentry_sdk
from snuba_sdk import Column, Condition

from sentry.discover.arithmetic import categorize_columns
from sentry.exceptions import IncompatibleMetricsQuery, InvalidSearchQuery
from sentry.models.organization import Organization
from sentry.search.events.types import EventsResponse, SnubaParams
from sentry.snuba import discover, transactions
from sentry.snuba.metrics.extraction import MetricSpecType
from sentry.snuba.metrics_performance import histogram_query as metrics_histogram_query
from sentry.snuba.metrics_performance import query as metrics_query
from sentry.snuba.metrics_performance import timeseries_query as metrics_timeseries_query
from sentry.snuba.metrics_performance import top_events_timeseries as metrics_top_events_timeseries
from sentry.snuba.query_sources import QuerySource
from sentry.utils.snuba import SnubaTSResult


def query(
    selected_columns: list[str],
    query: str,
    snuba_params: SnubaParams,
    equations: list[str] | None = None,
    orderby: list[str] | None = None,
    offset: int | None = None,
    limit: int = 50,
    referrer: str | None = None,
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
    use_metrics_layer: bool = False,
    skip_tag_resolution: bool = False,
    extra_columns: list[Column] | None = None,
    on_demand_metrics_enabled: bool = False,
    on_demand_metrics_type: MetricSpecType | None = None,
    fallback_to_transactions: bool = False,
    query_source: QuerySource | None = None,
):
    metrics_compatible = not equations
    dataset_reason = discover.DEFAULT_DATASET_REASON

    if metrics_compatible:
        try:
            result = metrics_query(
                selected_columns,
                query,
                snuba_params,
                equations,
                orderby,
                offset,
                limit,
                referrer,
                auto_fields,
                auto_aggregations,
                use_aggregate_conditions,
                allow_metric_aggregates,
                conditions,
                functions_acl,
                transform_alias_to_input_format,
                has_metrics,
                use_metrics_layer,
                on_demand_metrics_enabled,
                on_demand_metrics_type=on_demand_metrics_type,
                query_source=query_source,
            )
            result["meta"]["datasetReason"] = dataset_reason

            return result
        # raise Invalid Queries since the same thing will happen with discover
        except InvalidSearchQuery:
            raise
        # any remaining errors mean we should try again with discover
        except IncompatibleMetricsQuery as error:
            sentry_sdk.set_tag("performance.mep_incompatible", str(error))
            dataset_reason = str(error)
            metrics_compatible = False

    # Either metrics failed, or this isn't a query we can enhance with metrics
    if not metrics_compatible:
        dataset: types.ModuleType = discover
        if fallback_to_transactions:
            dataset = transactions
            sentry_sdk.set_tag("performance.dataset", "transactions")
        else:
            sentry_sdk.set_tag("performance.dataset", "discover")
        results = dataset.query(
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
        results["meta"]["datasetReason"] = dataset_reason

        return results

    return {}


def timeseries_query(
    selected_columns: Sequence[str],
    query: str,
    snuba_params: SnubaParams,
    rollup: int,
    referrer: str,
    zerofill_results: bool = True,
    allow_metric_aggregates=True,
    comparison_delta: timedelta | None = None,
    functions_acl: list[str] | None = None,
    has_metrics: bool = True,
    use_metrics_layer: bool = False,
    on_demand_metrics_enabled: bool = False,
    on_demand_metrics_type=None,
    query_source: QuerySource | None = None,
    fallback_to_transactions: bool = False,
    transform_alias_to_input_format: bool = False,
) -> SnubaTSResult:
    """
    High-level API for doing arbitrary user timeseries queries against events.
    this API should match that of sentry.snuba.discover.timeseries_query
    """
    equations, columns = categorize_columns(selected_columns)
    metrics_compatible = not equations

    if metrics_compatible:
        try:
            return metrics_timeseries_query(
                selected_columns,
                query,
                snuba_params,
                rollup,
                referrer=referrer,
                zerofill_results=zerofill_results,
                allow_metric_aggregates=allow_metric_aggregates,
                comparison_delta=comparison_delta,
                functions_acl=functions_acl,
                use_metrics_layer=use_metrics_layer,
                on_demand_metrics_enabled=on_demand_metrics_enabled,
                on_demand_metrics_type=on_demand_metrics_type,
                query_source=query_source,
                transform_alias_to_input_format=transform_alias_to_input_format,
            )
        # raise Invalid Queries since the same thing will happen with discover
        except InvalidSearchQuery:
            raise
        # any remaining errors mean we should try again with discover
        except IncompatibleMetricsQuery as error:
            sentry_sdk.set_tag("performance.mep_incompatible", str(error))
            metrics_compatible = False

    # This isn't a query we can enhance with metrics
    if not metrics_compatible:
        dataset: types.ModuleType = discover
        if fallback_to_transactions:
            dataset = transactions
            sentry_sdk.set_tag("performance.dataset", "transactions")
        else:
            sentry_sdk.set_tag("performance.dataset", "discover")
        return dataset.timeseries_query(
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
        )
    return SnubaTSResult(
        {
            "data": (
                discover.zerofill(
                    [], snuba_params.start_date, snuba_params.end_date, rollup, ["time"]
                )
                if zerofill_results
                else []
            ),
        },
        snuba_params.start_date,
        snuba_params.end_date,
        rollup,
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
    referrer: str | None = None,
    top_events: EventsResponse | None = None,
    allow_empty: bool = True,
    zerofill_results: bool = True,
    include_other: bool = False,
    functions_acl: list[str] | None = None,
    on_demand_metrics_enabled: bool = False,
    on_demand_metrics_type: MetricSpecType | None = None,
    query_source: QuerySource | None = None,
    fallback_to_transactions: bool = False,
) -> SnubaTSResult | dict[str, Any]:
    metrics_compatible = False
    equations, _ = categorize_columns(selected_columns)
    if not equations:
        metrics_compatible = True

    if metrics_compatible:
        try:
            return metrics_top_events_timeseries(
                timeseries_columns,
                selected_columns,
                user_query,
                snuba_params,
                orderby,
                rollup,
                limit,
                organization,
                equations,
                referrer,
                top_events,
                allow_empty,
                zerofill_results,
                include_other,
                functions_acl,
                on_demand_metrics_enabled=on_demand_metrics_enabled,
                on_demand_metrics_type=on_demand_metrics_type,
                query_source=query_source,
            )
        # raise Invalid Queries since the same thing will happen with discover
        except InvalidSearchQuery:
            raise
        # any remaining errors mean we should try again with discover
        except IncompatibleMetricsQuery as error:
            sentry_sdk.set_tag("performance.mep_incompatible", str(error))
            metrics_compatible = False

    # This isn't a query we can enhance with metrics
    if not metrics_compatible:
        dataset: types.ModuleType = discover
        if fallback_to_transactions:
            dataset = transactions
            sentry_sdk.set_tag("performance.dataset", "transactions")
        else:
            sentry_sdk.set_tag("performance.dataset", "discover")
        return dataset.top_events_timeseries(
            timeseries_columns,
            selected_columns,
            user_query,
            snuba_params,
            orderby,
            rollup,
            limit,
            organization,
            equations,
            referrer,
            top_events,
            allow_empty,
            zerofill_results,
            include_other,
            functions_acl,
            query_source=query_source,
        )
    return SnubaTSResult(
        {
            "data": (
                discover.zerofill(
                    [], snuba_params.start_date, snuba_params.end_date, rollup, ["time"]
                )
                if zerofill_results
                else []
            ),
        },
        snuba_params.start_date,
        snuba_params.end_date,
        rollup,
    )


def histogram_query(
    fields,
    user_query,
    snuba_params,
    num_buckets,
    precision=0,
    min_value=None,
    max_value=None,
    data_filter=None,
    referrer=None,
    group_by=None,
    order_by=None,
    limit_by=None,
    histogram_rows=None,
    extra_conditions=None,
    normalize_results=True,
    use_metrics_layer=False,
    on_demand_metrics_enabled=False,
    on_demand_metrics_type=None,
    query_source: QuerySource | None = None,
):
    """
    High-level API for doing arbitrary user timeseries queries against events.
    this API should match that of sentry.snuba.discover.histogram_query
    """
    # Must need to normalize results to be MEP
    metrics_compatible = normalize_results
    if metrics_compatible:
        try:
            return metrics_histogram_query(
                fields,
                user_query,
                snuba_params,
                num_buckets,
                precision,
                min_value,
                max_value,
                data_filter,
                referrer,
                group_by,
                order_by,
                limit_by,
                histogram_rows,
                extra_conditions,
                normalize_results,
                use_metrics_layer,
                query_source=query_source,
            )
        # raise Invalid Queries since the same thing will happen with discover
        except InvalidSearchQuery:
            raise
        # any remaining errors mean we should try again with discover
        except IncompatibleMetricsQuery as error:
            sentry_sdk.set_tag("performance.mep_incompatible", str(error))
            metrics_compatible = False

    # This isn't a query we can enhance with metrics
    if not metrics_compatible:
        sentry_sdk.set_tag("performance.dataset", "discover")
        return discover.histogram_query(
            fields,
            user_query,
            snuba_params,
            num_buckets,
            precision,
            min_value,
            max_value,
            data_filter,
            referrer,
            group_by,
            order_by,
            limit_by,
            histogram_rows,
            extra_conditions,
            normalize_results,
            query_source=query_source,
        )
    return {}
