from __future__ import annotations

import logging
from collections.abc import Sequence
from datetime import timedelta
from typing import Any, Literal, overload

import sentry_sdk
from snuba_sdk import Column, Condition

from sentry.discover.arithmetic import categorize_columns
from sentry.exceptions import IncompatibleMetricsQuery
from sentry.search.events.builder.metrics import (
    HistogramMetricQueryBuilder,
    MetricsQueryBuilder,
    TimeseriesMetricQueryBuilder,
    TopMetricsQueryBuilder,
)
from sentry.search.events.fields import get_function_alias
from sentry.search.events.types import EventsResponse, QueryBuilderConfig, SnubaParams
from sentry.snuba import discover
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics.extraction import MetricSpecType
from sentry.snuba.query_sources import QuerySource
from sentry.utils.snuba import SnubaTSResult, bulk_snuba_queries

logger = logging.getLogger(__name__)

INLIER_QUERY_CLAUSE = "histogram_outlier:inlier"


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
    allow_metric_aggregates: bool = True,
    use_aggregate_conditions: bool = False,
    conditions: list[Condition] | None = None,
    functions_acl: list[str] | None = None,
    transform_alias_to_input_format: bool = False,
    sample: float | None = None,
    has_metrics: bool = True,
    use_metrics_layer: bool = False,
    skip_tag_resolution: bool = False,
    on_demand_metrics_enabled: bool = False,
    on_demand_metrics_type: MetricSpecType | None = None,
    granularity: int | None = None,
    fallback_to_transactions=False,
    query_source: QuerySource | None = None,
) -> EventsResponse:
    with sentry_sdk.start_span(op="mep", name="MetricQueryBuilder"):
        metrics_query = MetricsQueryBuilder(
            dataset=Dataset.PerformanceMetrics,
            params={},
            snuba_params=snuba_params,
            query=query,
            selected_columns=selected_columns,
            equations=[],
            orderby=orderby,
            limit=limit,
            offset=offset,
            granularity=granularity,
            config=QueryBuilderConfig(
                auto_aggregations=auto_aggregations,
                use_aggregate_conditions=use_aggregate_conditions,
                allow_metric_aggregates=allow_metric_aggregates,
                functions_acl=functions_acl,
                # Auto fields will add things like id back in if enabled
                auto_fields=False,
                transform_alias_to_input_format=transform_alias_to_input_format,
                use_metrics_layer=use_metrics_layer,
                on_demand_metrics_enabled=on_demand_metrics_enabled,
                on_demand_metrics_type=on_demand_metrics_type,
            ),
        )
        if referrer is None:
            referrer = ""
        metrics_referrer = referrer + ".metrics-enhanced"
        results = metrics_query.run_query(
            referrer=metrics_referrer, query_source=query_source, use_cache=True
        )
    with sentry_sdk.start_span(op="mep", name="query.transform_results"):
        results = metrics_query.process_results(results)
        results["meta"]["isMetricsData"] = True
        results["meta"]["isMetricsExtractedData"] = metrics_query.use_on_demand
        sentry_sdk.set_tag("performance.dataset", "metrics")
        sentry_sdk.set_tag("on_demand.is_extracted", metrics_query.use_on_demand)
        return results


@overload
def bulk_timeseries_query(
    selected_columns: Sequence[str],
    queries: list[str],
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
    on_demand_metrics_type: MetricSpecType | None = None,
    groupby: Column | None = None,
    *,
    apply_formatting: Literal[False],
    query_source: QuerySource | None = None,
) -> EventsResponse: ...


@overload
def bulk_timeseries_query(
    selected_columns: Sequence[str],
    queries: list[str],
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
    on_demand_metrics_type: MetricSpecType | None = None,
    groupby: Column | None = None,
    query_source: QuerySource | None = None,
) -> SnubaTSResult: ...


def bulk_timeseries_query(
    selected_columns: Sequence[str],
    queries: list[str],
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
    on_demand_metrics_type: MetricSpecType | None = None,
    groupby: Column | None = None,
    query_source: QuerySource | None = None,
    *,
    apply_formatting: bool = True,
) -> SnubaTSResult | EventsResponse:
    """
    High-level API for doing *bulk* arbitrary user timeseries queries against events.
    this API should match that of sentry.snuba.discover.timeseries_query
    """
    metrics_compatible = False
    equations, columns = categorize_columns(selected_columns)
    if comparison_delta is None and not equations:
        metrics_compatible = True

    if metrics_compatible:
        with sentry_sdk.start_span(op="mep", name="TimeseriesMetricQueryBuilder"):
            metrics_queries = []
            for query in queries:
                metrics_query = TimeseriesMetricQueryBuilder(
                    {},
                    rollup,
                    snuba_params=snuba_params,
                    dataset=Dataset.PerformanceMetrics,
                    query=query,
                    selected_columns=columns,
                    groupby=groupby,
                    config=QueryBuilderConfig(
                        functions_acl=functions_acl,
                        allow_metric_aggregates=allow_metric_aggregates,
                        use_metrics_layer=use_metrics_layer,
                    ),
                )
                snql_query = metrics_query.get_snql_query()
                metrics_queries.append(snql_query[0])

            metrics_referrer = referrer + ".metrics-enhanced"
            bulk_result = bulk_snuba_queries(
                metrics_queries, metrics_referrer, query_source=query_source
            )
            _result: dict[str, Any] = {"data": []}
            for br in bulk_result:
                _result["data"] = [*_result["data"], *br["data"]]
                _result["meta"] = br["meta"]
        with sentry_sdk.start_span(op="mep", name="query.transform_results"):
            result = metrics_query.process_results(_result)
            sentry_sdk.set_tag("performance.dataset", "metrics")
            result["meta"]["isMetricsData"] = True

            # Sometimes additional formatting needs to be done downstream
            if not apply_formatting:
                return result  # EventsResponseData type

            result["data"] = (
                discover.zerofill(
                    result["data"],
                    snuba_params.start_date,
                    snuba_params.end_date,
                    rollup,
                    ["time"],
                )
                if zerofill_results
                else discover.format_time(
                    result["data"],
                    snuba_params.start_date,
                    snuba_params.end_date,
                    rollup,
                    ["time"],
                )
            )

            return SnubaTSResult(
                {
                    "data": result["data"],
                    "isMetricsData": True,
                    "meta": result["meta"],
                },
                snuba_params.start_date,
                snuba_params.end_date,
                rollup,
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
    on_demand_metrics_type: MetricSpecType | None = None,
    groupby: Column | None = None,
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

    def run_metrics_query(inner_params: SnubaParams):
        with sentry_sdk.start_span(op="mep", name="TimeseriesMetricQueryBuilder"):
            metrics_query = TimeseriesMetricQueryBuilder(
                params={},
                interval=rollup,
                snuba_params=inner_params,
                dataset=Dataset.PerformanceMetrics,
                query=query,
                selected_columns=columns,
                groupby=groupby,
                config=QueryBuilderConfig(
                    functions_acl=functions_acl,
                    allow_metric_aggregates=allow_metric_aggregates,
                    use_metrics_layer=use_metrics_layer,
                    on_demand_metrics_enabled=on_demand_metrics_enabled,
                    on_demand_metrics_type=on_demand_metrics_type,
                    transform_alias_to_input_format=transform_alias_to_input_format,
                ),
            )
            metrics_referrer = referrer + ".metrics-enhanced"
            result = metrics_query.run_query(referrer=metrics_referrer, query_source=query_source)
        with sentry_sdk.start_span(op="mep", name="query.transform_results"):
            result = metrics_query.process_results(result)
            result["data"] = (
                discover.zerofill(
                    result["data"],
                    inner_params.start_date,
                    inner_params.end_date,
                    rollup,
                    ["time"],
                )
                if zerofill_results
                else result["data"]
            )
            sentry_sdk.set_tag("performance.dataset", "metrics")
            result["meta"]["isMetricsData"] = True
            sentry_sdk.set_tag("on_demand.is_extracted", metrics_query.use_on_demand)
            result["meta"]["isMetricsExtractedData"] = metrics_query.use_on_demand

            return {
                "data": result["data"],
                "isMetricsData": True,
                "isMetricsExtractedData": metrics_query.use_on_demand,
                "meta": result["meta"],
            }

    if metrics_compatible:
        # We could run these two queries in a batch but this would require a big refactor in the `get_snql_query` method
        # of the TimeseriesMetricQueryBuilder. In case this becomes a performance bottleneck, we should invest more
        # time into properly performing batching.
        #
        # In case we want to support multiple aggregate comparisons, we can just remove the condition below and rework
        # the implementation of the `comparisonCount` field.
        result = run_metrics_query(inner_params=snuba_params)
        if comparison_delta:
            comparison_params = snuba_params.copy()
            assert comparison_params.start is not None, "start is required"
            assert comparison_params.end is not None, "end is required"
            comparison_params.start -= comparison_delta
            comparison_params.end -= comparison_delta
            result_to_compare = run_metrics_query(inner_params=comparison_params)

            aliased_columns = [
                get_function_alias(selected_column) for selected_column in selected_columns
            ]
            if len(aliased_columns) != 1:
                raise IncompatibleMetricsQuery(
                    "The comparison query for metrics supports only one aggregate."
                )

            merged_data = []
            for data, data_to_compare in zip(result["data"], result_to_compare["data"]):
                merged_item = {"time": data["time"]}

                for aliased_column in aliased_columns:
                    # We only add data in the dictionary in case it's not `None`, since the serializer,
                    # will convert all missing dictionary values to 0.
                    if (column := data.get(aliased_column)) is not None:
                        # We get from the main timeseries the actual result.
                        merged_item[aliased_column] = column

                    # It can be that we have the data in the comparison, in that case want to show it.
                    if (column := data_to_compare.get(aliased_column)) is not None:
                        # TODO: this implementation was copied over from discover to reduce the refactor size but it
                        #  would be better to prefix the comparisons with like `comparison_[alias]` and convert them
                        #  in the serializer.
                        merged_item["comparisonCount"] = column

                merged_data.append(merged_item)

            result["data"] = merged_data

        return SnubaTSResult(
            {
                "data": result["data"],
                "isMetricsData": True,
                "meta": result["meta"],
            },
            # We keep the params passed in the function as the time interval.
            snuba_params.start_date,
            snuba_params.end_date,
            rollup,
        )

    # In case the query was not compatible with metrics we return empty data.
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
    timeseries_columns,
    selected_columns,
    user_query,
    snuba_params,
    orderby,
    rollup,
    limit,
    organization,
    equations=None,
    referrer=None,
    top_events=None,
    allow_empty=True,
    zerofill_results=True,
    include_other=False,
    functions_acl=None,
    on_demand_metrics_enabled=False,
    on_demand_metrics_type: MetricSpecType | None = None,
    query_source: QuerySource | None = None,
    fallback_to_transactions: bool = False,
    transform_alias_to_input_format: bool = False,
) -> SnubaTSResult | dict[str, Any]:

    if top_events is None:
        top_events = query(
            selected_columns,
            query=user_query,
            snuba_params=snuba_params,
            equations=equations,
            orderby=orderby,
            limit=limit,
            referrer=referrer,
            auto_aggregations=True,
            use_aggregate_conditions=True,
            on_demand_metrics_enabled=on_demand_metrics_enabled,
            on_demand_metrics_type=on_demand_metrics_type,
            query_source=query_source,
        )

    top_events_builder = TopMetricsQueryBuilder(
        Dataset.PerformanceMetrics,
        params={},
        interval=rollup,
        top_events=top_events["data"],
        snuba_params=snuba_params,
        other=False,
        query=user_query,
        selected_columns=selected_columns,
        timeseries_columns=timeseries_columns,
        config=QueryBuilderConfig(
            functions_acl=functions_acl,
            on_demand_metrics_enabled=on_demand_metrics_enabled,
            on_demand_metrics_type=on_demand_metrics_type,
            transform_alias_to_input_format=transform_alias_to_input_format,
        ),
    )
    if len(top_events["data"]) == limit and include_other:
        other_events_builder = TopMetricsQueryBuilder(
            Dataset.PerformanceMetrics,
            params={},
            interval=rollup,
            top_events=top_events["data"],
            snuba_params=snuba_params,
            other=True,
            query=user_query,
            selected_columns=selected_columns,
            timeseries_columns=timeseries_columns,
            config=QueryBuilderConfig(
                on_demand_metrics_enabled=on_demand_metrics_enabled,
                on_demand_metrics_type=on_demand_metrics_type,
            ),
        )

        # TODO: use bulk_snuba_queries
        other_result = other_events_builder.run_query(referrer=referrer, query_source=query_source)
        result = top_events_builder.run_query(referrer=referrer, query_source=query_source)
    else:
        result = top_events_builder.run_query(referrer=referrer, query_source=query_source)
        other_result = {"data": []}
    if (
        not allow_empty
        and not len(result.get("data", []))
        and not len(other_result.get("data", []))
    ):
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

    result = top_events_builder.process_results(result)

    translated_groupby = top_events_builder.translated_groupby

    results: dict[str, Any] = (
        {discover.OTHER_KEY: {"order": limit, "data": other_result["data"]}}
        if len(other_result.get("data", []))
        else {}
    )
    # Using the top events add the order to the results
    for index, item in enumerate(top_events["data"]):
        result_key = discover.create_result_key(item, translated_groupby, {})
        results[result_key] = {"order": index, "data": []}
    for row in result["data"]:
        result_key = discover.create_result_key(row, translated_groupby, {})
        if result_key in results:
            results[result_key]["data"].append(row)
        else:
            logger.warning(
                "spans_metrics.top-events.timeseries.key-mismatch",
                extra={"result_key": result_key, "top_event_keys": list(results.keys())},
            )
    for key, item in results.items():
        results[key] = SnubaTSResult(
            {
                "data": (
                    discover.zerofill(
                        item["data"],
                        snuba_params.start_date,
                        snuba_params.end_date,
                        rollup,
                        ["time"],
                    )
                    if zerofill_results
                    else item["data"]
                ),
                "order": item["order"],
                "meta": {
                    # One of the queries in the builder has required, thus, we mark all of them
                    # This could mislead downstream consumers of the meta data
                    "isMetricsExtractedData": top_events_builder.use_on_demand,
                    **result["meta"],
                },
            },
            snuba_params.start_date,
            snuba_params.end_date,
            rollup,
        )

    return results


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
    use_metrics_layer=True,
    query_source: QuerySource | None = None,
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

    if data_filter == "exclude_outliers":
        if user_query is None:
            user_query = INLIER_QUERY_CLAUSE
        elif INLIER_QUERY_CLAUSE not in user_query:
            user_query += " " + INLIER_QUERY_CLAUSE

    multiplier = int(10**precision)
    if max_value is not None:
        # We want the specified max_value to be exclusive, and the queried max_value
        # to be inclusive. So we adjust the specified max_value using the multiplier.
        max_value -= 0.1 / multiplier

    min_value, max_value = discover.find_histogram_min_max(
        fields, min_value, max_value, user_query, snuba_params, data_filter, query_fn=query
    )
    if min_value is None or max_value is None:
        return {"meta": {"isMetricsData": True}}

    histogram_params = discover.find_histogram_params(num_buckets, min_value, max_value, multiplier)

    builder = HistogramMetricQueryBuilder(
        histogram_params,
        # Arguments for QueryBuilder
        dataset=Dataset.PerformanceMetrics,
        params={},
        snuba_params=snuba_params,
        query=user_query,
        selected_columns=[f"histogram({field})" for field in fields],
        orderby=order_by,
        limitby=limit_by,
        config=QueryBuilderConfig(
            use_metrics_layer=use_metrics_layer,
        ),
    )
    if extra_conditions is not None:
        builder.add_conditions(extra_conditions)
    results = builder.run_query(referrer, query_source=query_source)

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
    bucket_maps: dict[str, Any] = {field: {} for field in fields}
    # Only one row in metrics result
    data = results["data"][0]
    for field in fields:
        histogram_column = f"histogram({field})"
        histogram_alias = get_function_alias(histogram_column)
        bucket_maps[field] = {start: height for start, end, height in data[histogram_alias]}

    new_data: dict[str, Any] = {field: [] for field in fields}
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
