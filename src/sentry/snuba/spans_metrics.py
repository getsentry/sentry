import logging
from datetime import timedelta
from typing import Dict, List, Optional, Sequence

from snuba_sdk import Column

from sentry.search.events.builder import (
    SpansMetricsQueryBuilder,
    TimeseriesSpansMetricsQueryBuilder,
)
from sentry.search.events.builder.spans_metrics import TopSpansMetricsQueryBuilder
from sentry.snuba import discover
from sentry.snuba.dataset import Dataset
from sentry.utils.snuba import SnubaTSResult

logger = logging.getLogger(__name__)


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
    extra_columns=None,
):
    builder = SpansMetricsQueryBuilder(
        dataset=Dataset.PerformanceMetrics,
        params=params,
        snuba_params=snuba_params,
        query=query,
        selected_columns=selected_columns,
        equations=equations,
        orderby=orderby,
        auto_fields=auto_fields,
        auto_aggregations=auto_aggregations,
        use_aggregate_conditions=use_aggregate_conditions,
        functions_acl=functions_acl,
        limit=limit,
        offset=offset,
        equation_config={"auto_add": include_equation_fields},
        sample_rate=sample,
        has_metrics=has_metrics,
        transform_alias_to_input_format=transform_alias_to_input_format,
        skip_tag_resolution=skip_tag_resolution,
    )

    result = builder.process_results(builder.run_query(referrer))
    return result


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
    groupby: Optional[Column] = None,
) -> SnubaTSResult:
    """
    High-level API for doing arbitrary user timeseries queries against events.
    this API should match that of sentry.snuba.discover.timeseries_query
    """
    metrics_query = TimeseriesSpansMetricsQueryBuilder(
        params,
        rollup,
        dataset=Dataset.PerformanceMetrics,
        query=query,
        selected_columns=selected_columns,
        functions_acl=functions_acl,
        allow_metric_aggregates=allow_metric_aggregates,
        groupby=groupby,
    )
    result = metrics_query.run_query(referrer)

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


def top_events_timeseries(
    timeseries_columns,
    selected_columns,
    user_query,
    params,
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
):
    """
    High-level API for doing arbitrary user timeseries queries for a limited number of top events

    Returns a dictionary of SnubaTSResult objects that have been zerofilled in
    case of gaps. Each value of the dictionary should match the result of a timeseries query

    timeseries_columns (Sequence[str]) List of public aliases to fetch for the timeseries query,
                    usually matches the y-axis of the graph
    selected_columns (Sequence[str]) List of public aliases to fetch for the events query,
                    this is to determine what the top events are
    user_query (str) Filter query string to create conditions from. needs to be user_query
                    to not conflict with the function query
    params (Dict[str, str]) Filtering parameters with start, end, project_id, environment,
    orderby (Sequence[str]) The fields to order results by.
    rollup (int) The bucket width in seconds
    limit (int) The number of events to get timeseries for
    organization (Organization) Used to map group ids to short ids
    referrer (str|None) A referrer string to help locate the origin of this query.
    top_events (dict|None) A dictionary with a 'data' key containing a list of dictionaries that
                    represent the top events matching the query. Useful when you have found
                    the top events earlier and want to save a query.
    """
    if top_events is None:
        top_events = query(
            selected_columns,
            query=user_query,
            params=params,
            equations=equations,
            orderby=orderby,
            limit=limit,
            referrer=referrer,
            auto_aggregations=True,
            use_aggregate_conditions=True,
            include_equation_fields=True,
            skip_tag_resolution=True,
        )

    top_events_builder = TopSpansMetricsQueryBuilder(
        Dataset.PerformanceMetrics,
        params,
        rollup,
        top_events["data"],
        other=False,
        query=user_query,
        selected_columns=selected_columns,
        timeseries_columns=timeseries_columns,
        functions_acl=functions_acl,
        skip_tag_resolution=True,
    )
    if len(top_events["data"]) == limit and include_other:
        other_events_builder = TopSpansMetricsQueryBuilder(
            Dataset.PerformanceMetrics,
            params,
            rollup,
            top_events["data"],
            other=True,
            query=user_query,
            selected_columns=selected_columns,
            timeseries_columns=timeseries_columns,
        )

        # TODO: use bulk_snql_query
        other_result = other_events_builder.run_query(referrer)
        result = top_events_builder.run_query(referrer)
    else:
        result = top_events_builder.run_query(referrer)
        other_result = {"data": []}
    if (
        not allow_empty
        and not len(result.get("data", []))
        and not len(other_result.get("data", []))
    ):
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

    result = top_events_builder.process_results(result)

    translated_groupby = top_events_builder.translated_groupby

    results = (
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
                "data": discover.zerofill(
                    item["data"], params["start"], params["end"], rollup, "time"
                )
                if zerofill_results
                else item["data"],
                "order": item["order"],
            },
            params["start"],
            params["end"],
            rollup,
        )

    return results
