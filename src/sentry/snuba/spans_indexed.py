import logging
from datetime import timedelta
from typing import Dict, List, Optional, Sequence

import sentry_sdk

from sentry.discover.arithmetic import categorize_columns
from sentry.search.events.builder import (
    SpansIndexedQueryBuilder,
    TimeseriesSpanIndexedQueryBuilder,
    TopEventsSpanIndexedQueryBuilder,
)
from sentry.snuba import discover
from sentry.utils.snuba import Dataset, SnubaTSResult, bulk_snql_query

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
    builder = SpansIndexedQueryBuilder(
        Dataset.SpansIndexed,
        params,
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
) -> SnubaTSResult:
    """
    High-level API for doing arbitrary user timeseries queries against events.
    this API should match that of sentry.snuba.discover.timeseries_query
    """
    equations, columns = categorize_columns(selected_columns)

    with sentry_sdk.start_span(op="spans_indexed", description="TimeseriesSpanIndexedQueryBuilder"):
        query = TimeseriesSpanIndexedQueryBuilder(
            Dataset.SpansIndexed,
            params,
            rollup,
            query=query,
            selected_columns=columns,
            functions_acl=functions_acl,
        )
        result = query.run_query(referrer)
    with sentry_sdk.start_span(op="spans_indexed", description="query.transform_results"):
        result = query.process_results(result)
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

    return SnubaTSResult(
        {
            "data": result["data"],
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

    this API should match that of sentry.snuba.discover.top_events_timeseries
    """
    if top_events is None:
        with sentry_sdk.start_span(op="spans_indexed", description="top_events.fetch_events"):
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

    top_events_builder = TopEventsSpanIndexedQueryBuilder(
        Dataset.SpansIndexed,
        params,
        rollup,
        top_events["data"],
        other=False,
        query=user_query,
        selected_columns=selected_columns,
        timeseries_columns=timeseries_columns,
        equations=equations,
        functions_acl=functions_acl,
        skip_tag_resolution=True,
    )
    if len(top_events["data"]) == limit and include_other:
        other_events_builder = TopEventsSpanIndexedQueryBuilder(
            Dataset.SpansIndexed,
            params,
            rollup,
            top_events["data"],
            other=True,
            query=user_query,
            selected_columns=selected_columns,
            timeseries_columns=timeseries_columns,
            equations=equations,
        )
        result, other_result = bulk_snql_query(
            [top_events_builder.get_snql_query(), other_events_builder.get_snql_query()],
            referrer=referrer,
        )
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
    with sentry_sdk.start_span(
        op="spans_indexed", description="top_events.transform_results"
    ) as span:
        span.set_data("result_count", len(result.get("data", [])))
        result = top_events_builder.process_results(result)

        issues = {}
        translated_groupby = top_events_builder.translated_groupby

        results = (
            {discover.OTHER_KEY: {"order": limit, "data": other_result["data"]}}
            if len(other_result.get("data", []))
            else {}
        )
        # Using the top events add the order to the results
        for index, item in enumerate(top_events["data"]):
            result_key = discover.create_result_key(item, translated_groupby, issues)
            results[result_key] = {"order": index, "data": []}
        for row in result["data"]:
            result_key = discover.create_result_key(row, translated_groupby, issues)
            if result_key in results:
                results[result_key]["data"].append(row)
            else:
                logger.warning(
                    "spans_indexed.top-events.timeseries.key-mismatch",
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
