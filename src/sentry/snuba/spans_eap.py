import logging
from collections.abc import Mapping, Sequence
from datetime import timedelta
from typing import Any

import sentry_sdk
from snuba_sdk import Column, Condition

from sentry.discover.arithmetic import categorize_columns
from sentry.models.organization import Organization
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.builder.spans_indexed import (
    SpansEAPQueryBuilder,
    TimeseriesSpanEAPIndexedQueryBuilder,
    TopEventsSpanEAPQueryBuilder,
)
from sentry.search.events.types import EventsResponse, QueryBuilderConfig, SnubaParams
from sentry.snuba import discover
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics.extraction import MetricSpecType
from sentry.snuba.query_sources import QuerySource
from sentry.snuba.referrer import Referrer
from sentry.utils.snuba import SnubaTSResult, bulk_snuba_queries

logger = logging.getLogger(__name__)


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
    dataset: Dataset = Dataset.Discover,
    fallback_to_transactions: bool = False,
    query_source: QuerySource | None = None,
    enable_rpc: bool | None = False,
):
    builder = SpansEAPQueryBuilder(
        Dataset.SpansEAP,
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
            has_metrics=has_metrics,
            transform_alias_to_input_format=transform_alias_to_input_format,
            skip_tag_resolution=skip_tag_resolution,
            equation_config={"auto_add": include_equation_fields},
            auto_fields=auto_fields,
            auto_aggregations=auto_aggregations,
            use_aggregate_conditions=use_aggregate_conditions,
            functions_acl=functions_acl,
        ),
    )

    result = builder.process_results(
        builder.run_query(referrer=referrer, query_source=query_source)
    )
    return result


def timeseries_query(
    selected_columns: Sequence[str],
    query: str,
    snuba_params,
    rollup: int,
    referrer: str | None = None,
    zerofill_results: bool = True,
    comparison_delta: timedelta | None = None,
    functions_acl: list[str] | None = None,
    allow_metric_aggregates: bool = False,
    has_metrics: bool = False,
    use_metrics_layer: bool = False,
    on_demand_metrics_enabled: bool = False,
    on_demand_metrics_type: MetricSpecType | None = None,
    dataset: Dataset = Dataset.Discover,
    query_source: QuerySource | None = None,
) -> SnubaTSResult:
    """
    High-level API for doing arbitrary user timeseries queries against events.
    this API should match that of sentry.snuba.discover.timeseries_query
    """
    equations, columns = categorize_columns(selected_columns)

    with sentry_sdk.start_span(op="spans_indexed", description="TimeseriesSpanIndexedQueryBuilder"):
        querybuilder = TimeseriesSpanEAPIndexedQueryBuilder(
            Dataset.SpansEAP,
            {},
            rollup,
            snuba_params=snuba_params,
            query=query,
            selected_columns=columns,
            config=QueryBuilderConfig(
                functions_acl=functions_acl,
            ),
        )
        result = querybuilder.run_query(referrer, query_source=query_source)
    with sentry_sdk.start_span(op="spans_indexed", description="query.transform_results"):
        result = querybuilder.process_results(result)
        result["data"] = (
            discover.zerofill(
                result["data"],
                snuba_params.start_date,
                snuba_params.end_date,
                rollup,
                ["time"],
            )
            if zerofill_results
            else result["data"]
        )

    return SnubaTSResult(
        {
            "data": result["data"],
            "meta": result["meta"],
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
    dataset: Dataset = Dataset.Discover,
    query_source: QuerySource | None = None,
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
                snuba_params=snuba_params,
                equations=equations,
                orderby=orderby,
                limit=limit,
                referrer=referrer,
                auto_aggregations=True,
                use_aggregate_conditions=True,
                include_equation_fields=True,
                skip_tag_resolution=True,
                query_source=query_source,
            )

    top_events_builder = TopEventsSpanEAPQueryBuilder(
        Dataset.SpansEAP,
        {},
        rollup,
        top_events["data"],
        snuba_params=snuba_params,
        other=False,
        query=user_query,
        selected_columns=selected_columns,
        timeseries_columns=timeseries_columns,
        equations=equations,
        config=QueryBuilderConfig(
            functions_acl=functions_acl,
            skip_tag_resolution=True,
        ),
    )
    if len(top_events["data"]) == limit and include_other:
        other_events_builder = TopEventsSpanEAPQueryBuilder(
            Dataset.SpansEAP,
            {},
            rollup,
            top_events["data"],
            snuba_params=snuba_params,
            other=True,
            query=user_query,
            selected_columns=selected_columns,
            timeseries_columns=timeseries_columns,
            equations=equations,
        )
        result, other_result = bulk_snuba_queries(
            [top_events_builder.get_snql_query(), other_events_builder.get_snql_query()],
            referrer=referrer,
            query_source=query_source,
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
    with sentry_sdk.start_span(
        op="spans_indexed", description="top_events.transform_results"
    ) as span:
        span.set_data("result_count", len(result.get("data", [])))
        result = top_events_builder.process_results(result)

        issues: Mapping[int, str | None] = {}
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
        top_events_results: dict[str, SnubaTSResult] = {}
        for key, result_item in results.items():
            top_events_results[key] = SnubaTSResult(
                {
                    "data": (
                        discover.zerofill(
                            result_item["data"],
                            snuba_params.start_date,
                            snuba_params.end_date,
                            rollup,
                            ["time"],
                        )
                        if zerofill_results
                        else result_item["data"]
                    ),
                    "order": result_item["order"],
                },
                snuba_params.start_date,
                snuba_params.end_date,
                rollup,
            )

    return top_events_results


"""The run_*_query functions below will replace the ones above, and are the ones which will call the RPC instead of
snql"""


def run_table_query(
    params: SnubaParams,
    query_string: str,
    selected_columns: list[str],  # Aggregations & Fields?
    orderby: list[str],
    offset: int,
    limit: int,
    referrer: Referrer,
    config: SearchResolverConfig,
) -> Any:
    pass
    """Make the query"""
    # maker = SearchResolver(params)
    # columns, contexts = maker.resolve_columns(selected_columns)
    # query = maker.resolve_query(query_string)

    """Run the query"""
    # rpc = table_RPC(columns=[column.proto_definition for column in columns], query=query)
    # result = rpc.run()

    """Process the results"""
    # for row in result:
    #     for column in columns:
    #         column.process(row)
    # return result


def run_timeseries_query(
    params: SnubaParams,
    query_string: str,
    y_axes: list[str],
    groupby: list[str],
) -> Any:
    pass
    """Make the query"""
    # maker = SearchResolver(params)
    # groupby, contexts = maker.resolve_columns(groupby)
    # yaxes = maker.resolve_aggregate(y_axes)
    # query = maker.resolve_query(query_string)

    """Run the query"""
    # rpc = timeseries_RPC(columns=[column.proto_definition for column in groupby], query=query)
    # result = rpc.run()

    """Process the results"""
    # return _process_timeseries(result, columns)


def run_top_events_timeseries_query(
    params: SnubaParams,
    query_string: str,
    y_axes: list[str],
    groupby: list[str],
    orderby: list[str],
) -> Any:
    """We intentionally duplicate run_timeseries_query code here to reduce the complexity of needing multiple helper
    functions that both would call
    This is because at time of writing, the query construction is very straightforward, if that changes perhaps we can
    change this"""
    pass
    """Make the query"""
    # maker = SearchResolver(params)
    # top_events = run_table_query() with process_results off
    # new_conditions = construct conditions based on top_events
    # resolved_query = And(new_conditions, maker.resolve_query(query_string))
    # groupby, contexts = maker.resolve_columns(groupby)
    # yaxes = maker.resolve_aggregate(y_axes)

    """Run the query"""
    # rpc = timeseries_RPC(columns=[column.proto_definition for column in groupby], query=query)

    """Process the results"""
    # result = rpc.run()
    # return _process_timeseries(result, columns)


def _process_timeseries(result, columns):
    pass
    # for row in result:
    #     for column in columns:
    #         column.process(row)
    # return result
