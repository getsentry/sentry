import logging
from datetime import datetime
from typing import Any

import sentry_sdk

from sentry.exceptions import InvalidSearchQuery
from sentry.search.events.builder.profile_functions import (
    ProfileFunctionsQueryBuilder,
    ProfileFunctionsTimeseriesQueryBuilder,
    ProfileTopFunctionsTimeseriesQueryBuilder,
)
from sentry.search.events.types import QueryBuilderConfig, SnubaParams
from sentry.snuba.dataset import Dataset
from sentry.snuba.discover import transform_tips, zerofill
from sentry.snuba.metrics.extraction import MetricSpecType
from sentry.snuba.query_sources import QuerySource
from sentry.utils.snuba import SnubaTSResult

logger = logging.getLogger(__name__)


def query(
    selected_columns: list[str],
    query: str | None,
    snuba_params: SnubaParams,
    equations: list[str] | None = None,
    orderby: list[str] | None = None,
    offset: int = 0,
    limit: int = 50,
    limitby: tuple[str, int] | None = None,
    referrer: str = "",
    auto_fields: bool = False,
    auto_aggregations: bool = False,
    use_aggregate_conditions: bool = False,
    conditions=None,
    allow_metric_aggregates: bool = False,
    transform_alias_to_input_format: bool = False,
    has_metrics: bool = False,
    functions_acl: list[str] | None = None,
    use_metrics_layer: bool = False,
    on_demand_metrics_enabled: bool = False,
    on_demand_metrics_type: MetricSpecType | None = None,
    fallback_to_transactions=False,
    query_source: QuerySource | None = None,
) -> Any:
    if not selected_columns:
        raise InvalidSearchQuery("No columns selected")

    builder = ProfileFunctionsQueryBuilder(
        dataset=Dataset.Functions,
        params={},
        query=query,
        snuba_params=snuba_params,
        selected_columns=selected_columns,
        orderby=orderby,
        limit=limit,
        limitby=limitby,
        offset=offset,
        config=QueryBuilderConfig(
            auto_fields=False,
            auto_aggregations=auto_aggregations,
            use_aggregate_conditions=use_aggregate_conditions,
            transform_alias_to_input_format=transform_alias_to_input_format,
            functions_acl=functions_acl,
        ),
    )
    if conditions is not None:
        builder.add_conditions(conditions)
    result = builder.process_results(
        builder.run_query(referrer=referrer, query_source=query_source)
    )
    result["meta"]["tips"] = transform_tips(builder.tips)
    return result


def timeseries_query(
    selected_columns: list[str],
    query: str | None,
    snuba_params: SnubaParams,
    rollup: int,
    referrer: str = "",
    zerofill_results: bool = True,
    comparison_delta: datetime | None = None,
    functions_acl: list[str] | None = None,
    allow_metric_aggregates: bool = False,
    has_metrics: bool = False,
    use_metrics_layer: bool = False,
    on_demand_metrics_enabled: bool = False,
    on_demand_metrics_type: MetricSpecType | None = None,
    query_source: QuerySource | None = None,
    fallback_to_transactions: bool = False,
    transform_alias_to_input_format: bool = False,
) -> Any:

    builder = ProfileFunctionsTimeseriesQueryBuilder(
        dataset=Dataset.Functions,
        params={},
        snuba_params=snuba_params,
        query=query,
        interval=rollup,
        selected_columns=selected_columns,
        config=QueryBuilderConfig(
            functions_acl=functions_acl,
            transform_alias_to_input_format=transform_alias_to_input_format,
        ),
    )
    results = builder.run_query(referrer=referrer, query_source=query_source)
    results = builder.strip_alias_prefix(results)
    results = builder.process_results(results)

    return SnubaTSResult(
        {
            "data": (
                zerofill(
                    results["data"],
                    snuba_params.start_date,
                    snuba_params.end_date,
                    rollup,
                    ["time"],
                )
                if zerofill_results
                else results["data"]
            ),
            "meta": results["meta"],
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
    result_key_order=None,
    on_demand_metrics_enabled: bool = False,
    on_demand_metrics_type: MetricSpecType | None = None,
    query_source: QuerySource | None = None,
    fallback_to_transactions: bool = False,
):
    assert not include_other, "Other is not supported"  # TODO: support other

    if top_events is None:
        with sentry_sdk.start_span(op="discover.discover", name="top_events.fetch_events"):
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
                query_source=query_source,
            )

    top_functions_builder = ProfileTopFunctionsTimeseriesQueryBuilder(
        dataset=Dataset.Functions,
        params={},
        snuba_params=snuba_params,
        interval=rollup,
        top_events=top_events["data"],
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
        assert False, "Other is not supported"  # TODO: support other

    result = top_functions_builder.run_query(referrer=referrer, query_source=query_source)

    return format_top_events_timeseries_results(
        result,
        top_functions_builder,
        snuba_params,
        rollup,
        top_events=top_events,
        allow_empty=allow_empty,
        zerofill_results=zerofill_results,
        result_key_order=result_key_order,
    )


def format_top_events_timeseries_results(
    result,
    query_builder,
    snuba_params,
    rollup,
    top_events=None,
    allow_empty=True,
    zerofill_results=True,
    result_key_order=None,
):
    if top_events is None:
        assert top_events, "Need to provide top events"  # TODO: support this use case

    if not allow_empty and not len(result.get("data", [])):
        return SnubaTSResult(
            {
                "data": (
                    zerofill([], snuba_params.start_date, snuba_params.end_date, rollup, ["time"])
                    if zerofill_results
                    else []
                ),
            },
            snuba_params.start_date,
            snuba_params.end_date,
            rollup,
        )

    with sentry_sdk.start_span(op="discover.discover", name="top_events.transform_results") as span:
        result = query_builder.strip_alias_prefix(result)

        span.set_data("result_count", len(result.get("data", [])))
        processed_result = query_builder.process_results(result)

        if result_key_order is None:
            result_key_order = query_builder.translated_groupby

        results: dict[str, Any] = {}

        # Using the top events add the order to the results
        for index, item in enumerate(top_events["data"]):
            result_key = create_result_key(item, result_key_order)
            results[result_key] = {"order": index, "data": []}
        for row in processed_result["data"]:
            result_key = create_result_key(row, result_key_order)
            if result_key in results:
                results[result_key]["data"].append(row)
            else:
                logger.warning(
                    "discover.top-events.timeseries.key-mismatch",
                    extra={"result_key": result_key, "top_event_keys": list(results.keys())},
                )

        return {
            key: SnubaTSResult(
                {
                    "data": (
                        zerofill(
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
                    "meta": result["meta"],
                },
                snuba_params.start_date,
                snuba_params.end_date,
                rollup,
            )
            for key, item in results.items()
        }


def create_result_key(result_row, fields) -> str:
    values = []
    for field in fields:
        value = result_row.get(field)

        # some datasets can return lists as values, the functions dataset cannot
        # at this time, so there is no support for it yet

        values.append(str(value))
    key = ",".join(values)
    return key
