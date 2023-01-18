from copy import deepcopy
from datetime import timedelta
from typing import Dict, Optional, Sequence

import sentry_sdk

from sentry.discover.arithmetic import categorize_columns
from sentry.search.events.builder import IssuePlatformTimeseriesQueryBuilder
from sentry.search.events.fields import InvalidSearchQuery, get_json_meta_type
from sentry.snuba import discover
from sentry.snuba.discover import zerofill
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
    dry_run=False,
    transform_alias_to_input_format=False,
    has_metrics: bool = True,
    use_metrics_layer: bool = False,
):
    return discover.query(
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
        dataset=Dataset.IssuePlatform,
    )


def timeseries_query(
    selected_columns: Sequence[str],
    query: str,
    params: Dict[str, str],
    rollup: int,
    referrer: Optional[str] = None,
    zerofill_results: bool = True,
    comparison_delta: Optional[timedelta] = None,
    functions_acl: Optional[Sequence[str]] = None,
    allow_metric_aggregates=False,
    has_metrics=False,
    use_metrics_layer=False,
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
    with sentry_sdk.start_span(op="discover.discover", description="timeseries.filter_transform"):
        equations, columns = categorize_columns(selected_columns)
        base_builder = IssuePlatformTimeseriesQueryBuilder(
            Dataset.IssuePlatform,
            params,
            rollup,
            query=query,
            selected_columns=columns,
            equations=equations,
            functions_acl=functions_acl,
            has_metrics=has_metrics,
        )
        query_list = [base_builder]
        if comparison_delta:
            if len(base_builder.aggregates) != 1:
                raise InvalidSearchQuery("Only one column can be selected for comparison queries")
            comp_query_params = deepcopy(params)
            comp_query_params["start"] -= comparison_delta
            comp_query_params["end"] -= comparison_delta
            comparison_builder = IssuePlatformTimeseriesQueryBuilder(
                Dataset.IssuePlatform,
                comp_query_params,
                rollup,
                query=query,
                selected_columns=columns,
                equations=equations,
            )
            query_list.append(comparison_builder)

        query_results = bulk_snql_query([query.get_snql_query() for query in query_list], referrer)

    with sentry_sdk.start_span(op="discover.discover", description="timeseries.transform_results"):
        results = []
        for snql_query, result in zip(query_list, query_results):
            results.append(
                {
                    "data": zerofill(
                        result["data"],
                        snql_query.params.start,
                        snql_query.params.end,
                        rollup,
                        "time",
                    )
                    if zerofill_results
                    else result["data"],
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

    result = results[0]

    return SnubaTSResult(
        {
            "data": result["data"],
            "meta": {
                "fields": {
                    value["name"]: get_json_meta_type(
                        value["name"], value.get("type"), base_builder
                    )
                    for value in result["meta"]
                }
            },
        },
        params["start"],
        params["end"],
        rollup,
    )
