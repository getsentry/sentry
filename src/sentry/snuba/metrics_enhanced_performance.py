from __future__ import annotations

from datetime import timedelta
from typing import Any, Dict, List, Optional, Sequence

import sentry_sdk

from sentry.discover.arithmetic import categorize_columns
from sentry.exceptions import IncompatibleMetricsQuery, InvalidSearchQuery
from sentry.models.organization import Organization
from sentry.snuba import discover
from sentry.snuba.metrics.extraction import MetricSpecType
from sentry.snuba.metrics_performance import histogram_query as metrics_histogram_query
from sentry.snuba.metrics_performance import query as metrics_query
from sentry.snuba.metrics_performance import timeseries_query as metrics_timeseries_query
from sentry.snuba.metrics_performance import top_events_timeseries as metrics_top_events_timeseries
from sentry.utils.snuba import SnubaTSResult


def query(
    selected_columns,
    query,
    params,
    snuba_params=None,
    equations=None,
    orderby=None,
    offset=None,
    limit=50,
    referrer=None,
    auto_fields=False,
    auto_aggregations=False,
    use_aggregate_conditions=False,
    allow_metric_aggregates=True,
    conditions=None,
    functions_acl=None,
    transform_alias_to_input_format=False,
    has_metrics: bool = True,
    use_metrics_layer: bool = False,
    on_demand_metrics_enabled: bool = False,
    on_demand_metrics_type=None,
):
    metrics_compatible = not equations
    dataset_reason = discover.DEFAULT_DATASET_REASON

    if metrics_compatible:
        try:
            result = metrics_query(
                selected_columns,
                query,
                params,
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
            )
            result["meta"]["datasetReason"] = dataset_reason

            return result
        # raise Invalid Queries since the same thing will happen with discover
        except InvalidSearchQuery as error:
            raise error
        # any remaining errors mean we should try again with discover
        except IncompatibleMetricsQuery as error:
            sentry_sdk.set_tag("performance.mep_incompatible", str(error))
            dataset_reason = str(error)
            metrics_compatible = False
        except Exception as error:
            raise error

    # Either metrics failed, or this isn't a query we can enhance with metrics
    if not metrics_compatible:
        sentry_sdk.set_tag("performance.dataset", "discover")
        results = discover.query(
            selected_columns,
            query,
            params,
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
        )
        results["meta"]["isMetricsData"] = False
        results["meta"]["isMetricsExtractedData"] = False
        results["meta"]["datasetReason"] = dataset_reason

        return results

    return {}


def timeseries_query(
    selected_columns: Sequence[str],
    query: str,
    params: Dict[str, str],
    rollup: int,
    referrer: str,
    zerofill_results: bool = True,
    allow_metric_aggregates=True,
    comparison_delta: Optional[timedelta] = None,
    functions_acl: Optional[List[str]] = None,
    has_metrics: bool = True,
    use_metrics_layer: bool = False,
    on_demand_metrics_enabled: bool = False,
    on_demand_metrics_type=None,
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
                params,
                rollup,
                referrer,
                zerofill_results,
                allow_metric_aggregates,
                comparison_delta,
                functions_acl,
                use_metrics_layer=use_metrics_layer,
                on_demand_metrics_enabled=on_demand_metrics_enabled,
                on_demand_metrics_type=on_demand_metrics_type,
            )
        # raise Invalid Queries since the same thing will happen with discover
        except InvalidSearchQuery as error:
            raise error
        # any remaining errors mean we should try again with discover
        except IncompatibleMetricsQuery as error:
            sentry_sdk.set_tag("performance.mep_incompatible", str(error))
            metrics_compatible = False
        except Exception as error:
            raise error

    # This isn't a query we can enhance with metrics
    if not metrics_compatible:
        sentry_sdk.set_tag("performance.dataset", "discover")
        return discover.timeseries_query(
            selected_columns,
            query,
            params,
            rollup,
            referrer,
            zerofill_results,
            comparison_delta,
            functions_acl,
            has_metrics=has_metrics,
        )
    return SnubaTSResult(
        {
            "data": discover.zerofill([], params["start"], params["end"], rollup, "time")
            if zerofill_results
            else [],
        },
        params["start"],
        params["end"],
        rollup,
    )


def top_events_timeseries(
    timeseries_columns: Sequence[str],
    selected_columns: Sequence[str],
    user_query: str,
    params: dict[str, str],
    orderby: Sequence[str],
    rollup: int,
    limit: int,
    organization: Organization,
    equations: Optional[Sequence[Any]] = None,
    referrer: Optional[str] = None,
    top_events=None,
    allow_empty: Optional[bool] = True,
    zerofill_results: Optional[bool] = True,
    include_other: Optional[bool] = False,
    functions_acl: Optional[List[str]] = None,
    on_demand_metrics_enabled: Optional[bool] = False,
    on_demand_metrics_type: Optional[MetricSpecType] = None,
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
                params,
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
            )
        # raise Invalid Queries since the same thing will happen with discover
        except InvalidSearchQuery as error:
            raise error
        # any remaining errors mean we should try again with discover
        except IncompatibleMetricsQuery as error:
            sentry_sdk.set_tag("performance.mep_incompatible", str(error))
            metrics_compatible = False
        except Exception as error:
            raise error

    # This isn't a query we can enhance with metrics
    if not metrics_compatible:
        sentry_sdk.set_tag("performance.dataset", "discover")
        return discover.top_events_timeseries(
            timeseries_columns,
            selected_columns,
            user_query,
            params,
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
        )
    return SnubaTSResult(
        {
            "data": discover.zerofill([], params["start"], params["end"], rollup, "time")
            if zerofill_results
            else [],
        },
        params["start"],
        params["end"],
        rollup,
    )


def histogram_query(
    fields,
    user_query,
    params,
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
                params,
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
            )
        # raise Invalid Queries since the same thing will happen with discover
        except InvalidSearchQuery as error:
            raise error
        # any remaining errors mean we should try again with discover
        except IncompatibleMetricsQuery as error:
            sentry_sdk.set_tag("performance.mep_incompatible", str(error))
            metrics_compatible = False
        except Exception as error:
            raise error

    # This isn't a query we can enhance with metrics
    if not metrics_compatible:
        sentry_sdk.set_tag("performance.dataset", "discover")
        return discover.histogram_query(
            fields,
            user_query,
            params,
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
        )
    return {}
