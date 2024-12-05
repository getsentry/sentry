from collections.abc import Sequence
from datetime import timedelta

import sentry_sdk

from sentry.discover.arithmetic import categorize_columns
from sentry.exceptions import InvalidSearchQuery
from sentry.search.events.builder.discover import DiscoverQueryBuilder
from sentry.search.events.builder.issue_platform import IssuePlatformTimeseriesQueryBuilder
from sentry.search.events.types import EventsResponse, QueryBuilderConfig, SnubaParams
from sentry.snuba.dataset import Dataset
from sentry.snuba.discover import transform_tips, zerofill
from sentry.snuba.metrics.extraction import MetricSpecType
from sentry.snuba.query_sources import QuerySource
from sentry.utils.snuba import SnubaTSResult, bulk_snuba_queries


def query(
    selected_columns,
    query,
    snuba_params,
    equations=None,
    orderby=None,
    offset=None,
    limit=50,
    referrer=None,
    auto_fields=False,
    auto_aggregations=False,
    include_equation_fields=False,
    allow_metric_aggregates=False,
    use_aggregate_conditions=False,
    conditions=None,
    functions_acl=None,
    transform_alias_to_input_format=False,
    sample=None,
    has_metrics=False,
    use_metrics_layer=False,
    skip_tag_resolution=False,
    on_demand_metrics_enabled=False,
    on_demand_metrics_type: MetricSpecType | None = None,
    fallback_to_transactions=False,
    query_source: QuerySource | None = None,
) -> EventsResponse:
    """
    High-level API for doing arbitrary user queries against events.

    This function operates on the Discover public event schema and
    virtual fields/aggregate functions for selected columns and
    conditions are supported through this function.

    The resulting list will have all internal field names mapped
    back into their public schema names.

    selected_columns (Sequence[str]) List of public aliases to fetch.
    query (str) Filter query string to create conditions from.
    params (Dict[str, str]) Filtering parameters with start, end, project_id, environment
    equations (Sequence[str]) List of equations to calculate for the query
    orderby (None|str|Sequence[str]) The field to order results by.
    offset (None|int) The record offset to read.
    limit (int) The number of records to fetch.
    referrer (str|None) A referrer string to help locate the origin of this query.
    auto_fields (bool) Set to true to have project + eventid fields automatically added.
    auto_aggregations (bool) Whether aggregates should be added automatically if they're used
                    in conditions, and there's at least one aggregate already.
    include_equation_fields (bool) Whether fields should be added automatically if they're used in
                    equations
    allow_metric_aggregates (bool) Ignored here, only used in metric enhanced performance
    use_aggregate_conditions (bool) Set to true if aggregates conditions should be used at all.
    conditions (Sequence[Condition]) List of conditions that are passed directly to snuba without
                    any additional processing.
    transform_alias_to_input_format (bool) Whether aggregate columns should be returned in the originally
                                requested function format.
    sample (float) The sample rate to run the query with
    """
    if not selected_columns:
        raise InvalidSearchQuery("No columns selected")

    builder = DiscoverQueryBuilder(
        Dataset.IssuePlatform,
        {},
        snuba_params=snuba_params,
        query=query,
        selected_columns=selected_columns,
        equations=equations,
        orderby=orderby,
        limit=limit,
        offset=offset,
        sample_rate=sample,
        config=QueryBuilderConfig(
            auto_fields=auto_fields,
            auto_aggregations=auto_aggregations,
            use_aggregate_conditions=use_aggregate_conditions,
            functions_acl=functions_acl,
            equation_config={"auto_add": include_equation_fields},
            has_metrics=has_metrics,
            transform_alias_to_input_format=transform_alias_to_input_format,
            skip_tag_resolution=skip_tag_resolution,
        ),
    )
    if conditions is not None:
        builder.add_conditions(conditions)
    result = builder.process_results(builder.run_query(referrer, query_source=query_source))
    result["meta"]["tips"] = transform_tips(builder.tips)
    return result


def timeseries_query(
    selected_columns: Sequence[str],
    query: str,
    snuba_params: SnubaParams,
    rollup: int,
    referrer: str | None = None,
    zerofill_results: bool = True,
    comparison_delta: timedelta | None = None,
    functions_acl: list[str] | None = None,
    allow_metric_aggregates=False,
    has_metrics=False,
    use_metrics_layer=False,
    on_demand_metrics_enabled=False,
    on_demand_metrics_type: MetricSpecType | None = None,
    query_source: QuerySource | None = None,
    fallback_to_transactions: bool = False,
    transform_alias_to_input_format: bool = False,
):
    """
    High-level API for doing arbitrary user timeseries queries against events.

    This function operates on the public event schema and
    virtual fields/aggregate functions for selected columns and
    conditions are supported through this function.

    This function is intended to only get timeseries based
    results and thus requires the `rollup` parameter.

    Returns a SnubaTSResult object that has been zerofilled in
    case of gaps.

    selected_columns (Sequence[str]) List of public aliases to fetch.
    query (str) Filter query string to create conditions from.
    params (Dict[str, str]) Filtering parameters with start, end, project_id, environment,
    rollup (int) The bucket width in seconds
    referrer (str|None) A referrer string to help locate the origin of this query.
    comparison_delta: A timedelta used to convert this into a comparison query. We make a second
    query time-shifted back by comparison_delta, and compare the results to get the % change for each
    time bucket. Requires that we only pass
    allow_metric_aggregates (bool) Ignored here, only used in metric enhanced performance
    """

    with sentry_sdk.start_span(op="issueplatform", name="timeseries.filter_transform"):
        equations, columns = categorize_columns(selected_columns)
        base_builder = IssuePlatformTimeseriesQueryBuilder(
            Dataset.IssuePlatform,
            {},
            rollup,
            snuba_params=snuba_params,
            query=query,
            selected_columns=columns,
            equations=equations,
            config=QueryBuilderConfig(
                functions_acl=functions_acl,
                has_metrics=has_metrics,
                transform_alias_to_input_format=transform_alias_to_input_format,
            ),
        )
        query_list = [base_builder]
        if comparison_delta:
            if len(base_builder.aggregates) != 1:
                raise InvalidSearchQuery("Only one column can be selected for comparison queries")
            comp_query_params = snuba_params.copy()
            comp_query_params.start -= comparison_delta
            comp_query_params.end -= comparison_delta
            comparison_builder = IssuePlatformTimeseriesQueryBuilder(
                Dataset.IssuePlatform,
                {},
                rollup,
                snuba_params=comp_query_params,
                query=query,
                selected_columns=columns,
                equations=equations,
            )
            query_list.append(comparison_builder)

        query_results = bulk_snuba_queries(
            [query.get_snql_query() for query in query_list], referrer, query_source=query_source
        )

    with sentry_sdk.start_span(op="issueplatform", name="timeseries.transform_results"):
        results = []
        for snql_query, result in zip(query_list, query_results):
            results.append(
                {
                    "data": (
                        zerofill(
                            result["data"],
                            snql_query.params.start,
                            snql_query.params.end,
                            rollup,
                            "time",
                        )
                        if zerofill_results
                        else result["data"]
                    ),
                    "meta": result["meta"],
                }
            )

    if len(results) == 2 and comparison_delta:
        col_name = base_builder.aggregates[0].alias
        # If we have two sets of results then we're doing a comparison queries. Divide the primary
        # results by the comparison results.
        for result, cmp_result in zip(results[0]["data"], results[1]["data"]):
            cmp_result_val = cmp_result.get(col_name, 0)
            result["comparisonCount"] = cmp_result_val

    result = base_builder.process_results(results[0])

    return SnubaTSResult(
        {
            "data": result["data"],
            "meta": result["meta"],
        },
        snuba_params.start_date,
        snuba_params.end_date,
        rollup,
    )
