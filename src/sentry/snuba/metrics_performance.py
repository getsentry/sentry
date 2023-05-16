from datetime import timedelta
from typing import Dict, List, Optional, Sequence

import sentry_sdk
from snuba_sdk import Column

from sentry.discover.arithmetic import categorize_columns
from sentry.search.events.builder import (
    HistogramMetricQueryBuilder,
    MetricsQueryBuilder,
    TimeseriesMetricQueryBuilder,
)
from sentry.search.events.fields import get_function_alias
from sentry.snuba import discover
from sentry.utils.snuba import Dataset, SnubaTSResult, bulk_snql_query


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
):
    with sentry_sdk.start_span(op="mep", description="MetricQueryBuilder"):
        metrics_query = MetricsQueryBuilder(
            params,
            snuba_params=snuba_params,
            query=query,
            selected_columns=selected_columns,
            equations=[],
            orderby=orderby,
            # Auto fields will add things like id back in if enabled
            auto_fields=False,
            auto_aggregations=auto_aggregations,
            use_aggregate_conditions=use_aggregate_conditions,
            allow_metric_aggregates=allow_metric_aggregates,
            functions_acl=functions_acl,
            limit=limit,
            offset=offset,
            dataset=Dataset.PerformanceMetrics,
            transform_alias_to_input_format=transform_alias_to_input_format,
            use_metrics_layer=use_metrics_layer,
        )
        metrics_referrer = referrer + ".metrics-enhanced"
        results = metrics_query.run_query(metrics_referrer)
    with sentry_sdk.start_span(op="mep", description="query.transform_results"):
        results = metrics_query.process_results(results)
        results["meta"]["isMetricsData"] = True
        sentry_sdk.set_tag("performance.dataset", "metrics")
        return results


def bulk_timeseries_query(
    selected_columns: Sequence[str],
    queries: List[str],
    params: Dict[str, str],
    rollup: int,
    referrer: str,
    zerofill_results: bool = True,
    allow_metric_aggregates=True,
    comparison_delta: Optional[timedelta] = None,
    functions_acl: Optional[List[str]] = None,
    has_metrics: bool = True,
    use_metrics_layer: bool = False,
    groupby: Optional[Column] = None,
    apply_formatting: Optional[bool] = True,
) -> SnubaTSResult:
    """
    High-level API for doing *bulk* arbitrary user timeseries queries against events.
    this API should match that of sentry.snuba.discover.timeseries_query
    """
    metrics_compatible = False
    equations, columns = categorize_columns(selected_columns)
    if comparison_delta is None and not equations:
        metrics_compatible = True

    if metrics_compatible:
        with sentry_sdk.start_span(op="mep", description="TimeseriesMetricQueryBuilder"):
            metrics_queries = []
            metrics_query = None
            for query in queries:
                metrics_query = TimeseriesMetricQueryBuilder(
                    params,
                    rollup,
                    dataset=Dataset.PerformanceMetrics,
                    query=query,
                    selected_columns=columns,
                    functions_acl=functions_acl,
                    allow_metric_aggregates=allow_metric_aggregates,
                    use_metrics_layer=use_metrics_layer,
                    groupby=groupby,
                )
                snql_query = metrics_query.get_snql_query()
                metrics_queries.append(snql_query[0])

            metrics_referrer = referrer + ".metrics-enhanced"
            bulk_result = bulk_snql_query(metrics_queries, metrics_referrer)
            result = {"data": []}
            for br in bulk_result:
                result["data"] = [*result["data"], *br["data"]]
                result["meta"] = br["meta"]
        with sentry_sdk.start_span(op="mep", description="query.transform_results"):
            result = metrics_query.process_results(result)
            sentry_sdk.set_tag("performance.dataset", "metrics")
            result["meta"]["isMetricsData"] = True

            # Sometimes additional formatting needs to be done downstream
            if not apply_formatting:
                return result

            result["data"] = (
                discover.zerofill(
                    result["data"],
                    params["start"],
                    params["end"],
                    rollup,
                    "time",
                )
                if zerofill_results
                else discover.format_time(
                    result["data"],
                    params["start"],
                    params["end"],
                    rollup,
                    "time",
                )
            )

            return SnubaTSResult(
                {
                    "data": result["data"],
                    "isMetricsData": True,
                    "meta": result["meta"],
                },
                params["start"],
                params["end"],
                rollup,
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
    groupby: Optional[Column] = None,
) -> SnubaTSResult:
    """
    High-level API for doing arbitrary user timeseries queries against events.
    this API should match that of sentry.snuba.discover.timeseries_query
    """
    metrics_compatible = False
    equations, columns = categorize_columns(selected_columns)
    if comparison_delta is None and not equations:
        metrics_compatible = True

    if metrics_compatible:
        with sentry_sdk.start_span(op="mep", description="TimeseriesMetricQueryBuilder"):
            metrics_query = TimeseriesMetricQueryBuilder(
                params,
                rollup,
                dataset=Dataset.PerformanceMetrics,
                query=query,
                selected_columns=columns,
                functions_acl=functions_acl,
                allow_metric_aggregates=allow_metric_aggregates,
                use_metrics_layer=use_metrics_layer,
                groupby=groupby,
            )
            metrics_referrer = referrer + ".metrics-enhanced"
            result = metrics_query.run_query(metrics_referrer)
        with sentry_sdk.start_span(op="mep", description="query.transform_results"):
            result = metrics_query.process_results(result)
            result["data"] = (
                discover.zerofill(
                    result["data"],
                    params["start"],
                    params["end"],
                    rollup,
                    "time",
                )
                if zerofill_results
                else result["data"]
            )
            sentry_sdk.set_tag("performance.dataset", "metrics")
            result["meta"]["isMetricsData"] = True

            return SnubaTSResult(
                {
                    "data": result["data"],
                    "isMetricsData": True,
                    "meta": result["meta"],
                },
                params["start"],
                params["end"],
                rollup,
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
    use_metrics_layer=True,
):
    """
    API for generating histograms for numeric columns.

    A multihistogram is possible only if the columns are all array columns.
    Array columns are columns whose values are nested arrays.
    Measurements and span op breakdowns are examples of array columns.
    The resulting histograms will have their bins aligned.

    :param [str] fields: The list of fields for which you want to generate histograms for.
    :param str user_query: Filter query string to create conditions from.
    :param {str: str} params: Filtering parameters with start, end, project_id, environment
    :param int num_buckets: The number of buckets the histogram should contain.
    :param int precision: The number of decimal places to preserve, default 0.
    :param float min_value: The minimum value allowed to be in the histogram.
        If left unspecified, it is queried using `user_query` and `params`.
    :param float max_value: The maximum value allowed to be in the histogram.
        If left unspecified, it is queried using `user_query` and `params`.
    :param str data_filter: Indicate the filter strategy to be applied to the data.
    :param [str] group_by: Allows additional grouping to serve multifacet histograms.
    :param [str] order_by: Allows additional ordering within each alias to serve multifacet histograms.
    :param [str] limit_by: Allows limiting within a group when serving multifacet histograms.
    :param int histogram_rows: Used to modify the limit when fetching multiple rows of buckets (performance facets).
    :param [Condition] extra_conditions: Adds any additional conditions to the histogram query that aren't received from params.
    :param bool normalize_results: Indicate whether to normalize the results by column into bins.
    """

    multiplier = int(10**precision)
    if max_value is not None:
        # We want the specified max_value to be exclusive, and the queried max_value
        # to be inclusive. So we adjust the specified max_value using the multiplier.
        max_value -= 0.1 / multiplier

    min_value, max_value = discover.find_histogram_min_max(
        fields, min_value, max_value, user_query, params, data_filter, query_fn=query
    )
    if min_value is None or max_value is None:
        return {"meta": {"isMetricsData": True}}

    histogram_params = discover.find_histogram_params(num_buckets, min_value, max_value, multiplier)

    builder = HistogramMetricQueryBuilder(
        histogram_params,
        # Arguments for QueryBuilder
        dataset=Dataset.PerformanceMetrics,
        params=params,
        query=user_query,
        selected_columns=[f"histogram({field})" for field in fields],
        orderby=order_by,
        limitby=limit_by,
        use_metrics_layer=use_metrics_layer,
    )
    if extra_conditions is not None:
        builder.add_conditions(extra_conditions)
    results = builder.run_query(referrer)

    # TODO: format to match non-metric-result
    if not normalize_results:
        return results

    result = normalize_histogram_results(fields, histogram_params, results)
    result["meta"] = {"isMetricsData": True}
    return result


def normalize_histogram_results(fields, histogram_params, results):
    """
    Normalizes the histogram results by renaming the columns to key and bin
    and make sure to zerofill any missing values.

    :param [str] fields: The list of fields for which you want to generate the
        histograms for.
    :param str key_column: The column of the key name.
    :param HistogramParams histogram_params: The histogram parameters used.
    :param any results: The results from the histogram query that may be missing
        bins and needs to be normalized.
    :param str array_column: Array column prefix
    """

    # zerofill and rename the columns while making sure to adjust for precision
    bucket_maps = {field: {} for field in fields}
    # Only one row in metrics result
    data = results["data"][0]
    for field in fields:
        histogram_column = f"histogram({field})"
        histogram_alias = get_function_alias(histogram_column)
        bucket_maps[field] = {start: height for start, end, height in data[histogram_alias]}

    new_data = {field: [] for field in fields}
    for i in range(histogram_params.num_buckets):
        bucket = histogram_params.start_offset + histogram_params.bucket_size * i
        for field in fields:
            row = {
                "bin": bucket,
                "count": bucket_maps[field].get(bucket, 0),
            }
            # make sure to adjust for the precision if necessary
            if histogram_params.multiplier > 1:
                row["bin"] /= float(histogram_params.multiplier)
            new_data[field].append(row)

    return new_data
