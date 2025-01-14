import logging
from collections.abc import Mapping, Sequence
from datetime import timedelta
from typing import cast

import sentry_sdk
from snuba_sdk import Column, Condition

from sentry.discover.arithmetic import categorize_columns
from sentry.exceptions import InvalidSearchQuery
from sentry.models.group import STATUS_QUERY_CHOICES, Group
from sentry.models.organization import Organization
from sentry.search.events.builder.errors import (
    ErrorsQueryBuilder,
    ErrorsTimeseriesQueryBuilder,
    ErrorsTopEventsQueryBuilder,
)
from sentry.search.events.types import EventsResponse, QueryBuilderConfig, SnubaParams
from sentry.snuba.dataset import Dataset
from sentry.snuba.discover import OTHER_KEY, TOP_KEYS_DEFAULT_LIMIT, FacetResult, create_result_key
from sentry.snuba.discover import get_facets as get_discover_facets
from sentry.snuba.discover import transform_tips, zerofill
from sentry.snuba.metrics.extraction import MetricSpecType
from sentry.snuba.query_sources import QuerySource
from sentry.utils.snuba import SnubaTSResult, bulk_snuba_queries

is_filter_translation = {}
for status_key, status_value in STATUS_QUERY_CHOICES.items():
    is_filter_translation[status_key] = ("status", status_value)
PARSER_CONFIG_OVERRIDES = {"is_filter_translation": is_filter_translation}

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
    dataset: Dataset = Dataset.Events,
    fallback_to_transactions: bool = False,
    query_source: QuerySource | None = None,
) -> EventsResponse:
    if not selected_columns:
        raise InvalidSearchQuery("No columns selected")

    builder = ErrorsQueryBuilder(
        Dataset.Events,
        params={},
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
            parser_config_overrides=PARSER_CONFIG_OVERRIDES,
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

    with sentry_sdk.start_span(op="errors", name="timeseries.filter_transform"):
        equations, columns = categorize_columns(selected_columns)
        base_builder = ErrorsTimeseriesQueryBuilder(
            Dataset.Events,
            params={},
            interval=rollup,
            snuba_params=snuba_params,
            query=query,
            selected_columns=columns,
            equations=equations,
            config=QueryBuilderConfig(
                functions_acl=functions_acl,
                has_metrics=has_metrics,
                parser_config_overrides=PARSER_CONFIG_OVERRIDES,
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
            comparison_builder = ErrorsTimeseriesQueryBuilder(
                Dataset.Events,
                {},
                rollup,
                snuba_params=comp_query_params,
                query=query,
                selected_columns=columns,
                equations=equations,
                config=QueryBuilderConfig(parser_config_overrides=PARSER_CONFIG_OVERRIDES),
            )
            query_list.append(comparison_builder)

        query_results = bulk_snuba_queries(
            [query.get_snql_query() for query in query_list], referrer, query_source=query_source
        )

    with sentry_sdk.start_span(op="errors", name="timeseries.transform_results"):
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
                            time_col_name="events.time",
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
    fallback_to_transactions: bool = False,
) -> dict[str, SnubaTSResult] | SnubaTSResult:
    """
    High-level API for doing arbitrary user timeseries queries for a limited number of top events

    Returns a dictionary of SnubaTSResult objects that have been zerofilled in
    case of gaps. Each value of the dictionary should match the result of a timeseries query

    timeseries_columns - List of public aliases to fetch for the timeseries query,
                    usually matches the y-axis of the graph
    selected_columns - List of public aliases to fetch for the events query,
                    this is to determine what the top events are
    user_query - Filter query string to create conditions from. needs to be user_query
                    to not conflict with the function query
    params - Filtering parameters with start, end, project_id, environment,
    orderby - The fields to order results by.
    rollup - The bucket width in seconds
    limit - The number of events to get timeseries for
    organization - Used to map group ids to short ids
    referrer - A referrer string to help locate the origin of this query.
    top_events - A dictionary with a 'data' key containing a list of dictionaries that
                    represent the top events matching the query. Useful when you have found
                    the top events earlier and want to save a query.
    """
    if top_events is None:
        with sentry_sdk.start_span(op="discover.errors", name="top_events.fetch_events"):
            top_events = query(
                selected_columns,
                query=user_query,
                equations=equations,
                orderby=orderby,
                limit=limit,
                referrer=referrer,
                snuba_params=snuba_params,
                auto_aggregations=True,
                use_aggregate_conditions=True,
                include_equation_fields=True,
                skip_tag_resolution=True,
                query_source=query_source,
            )

    top_events_builder = ErrorsTopEventsQueryBuilder(
        Dataset.Events,
        params={},
        interval=rollup,
        top_events=top_events["data"],
        other=False,
        query=user_query,
        selected_columns=selected_columns,
        timeseries_columns=timeseries_columns,
        equations=equations,
        snuba_params=snuba_params,
        config=QueryBuilderConfig(
            functions_acl=functions_acl,
            skip_tag_resolution=True,
        ),
    )
    if len(top_events["data"]) == limit and include_other:
        other_events_builder = ErrorsTopEventsQueryBuilder(
            Dataset.Events,
            params={},
            interval=rollup,
            top_events=top_events["data"],
            other=True,
            query=user_query,
            selected_columns=selected_columns,
            timeseries_columns=timeseries_columns,
            equations=equations,
            snuba_params=snuba_params,
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
                    zerofill([], snuba_params.start_date, snuba_params.end_date, rollup, ["time"])
                    if zerofill_results
                    else []
                ),
            },
            snuba_params.start_date,
            snuba_params.end_date,
            rollup,
        )
    with sentry_sdk.start_span(op="discover.errors", name="top_events.transform_results") as span:
        span.set_data("result_count", len(result.get("data", [])))
        result = top_events_builder.process_results(result)

        issues: Mapping[int, str | None] = {}
        if "issue" in selected_columns:
            issues = Group.objects.get_issues_mapping(
                {cast(int, event["issue.id"]) for event in top_events["data"]},
                snuba_params.project_ids,
                organization,
            )
        translated_groupby = top_events_builder.translated_groupby

        results = (
            {OTHER_KEY: {"order": limit, "data": other_result["data"]}}
            if len(other_result.get("data", []))
            else {}
        )
        # Using the top events add the order to the results
        for index, item in enumerate(top_events["data"]):
            result_key = create_result_key(item, translated_groupby, issues)
            results[result_key] = {"order": index, "data": []}
        for row in result["data"]:
            result_key = create_result_key(row, translated_groupby, issues)
            if result_key in results:
                results[result_key]["data"].append(row)
            else:
                logger.warning(
                    "discover.top-events.timeseries.key-mismatch",
                    extra={"result_key": result_key, "top_event_keys": list(results.keys())},
                )

        top_events_results: dict[str, SnubaTSResult] = {}
        for key, item in results.items():
            top_events_results[key] = SnubaTSResult(
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
                    "meta": result["meta"],
                    "order": item["order"],
                },
                snuba_params.start_date,
                snuba_params.end_date,
                rollup,
            )

    return top_events_results


def get_facets(
    query: str | None,
    snuba_params: SnubaParams,
    referrer: str,
    per_page: int | None = TOP_KEYS_DEFAULT_LIMIT,
    cursor: int | None = 0,
    dataset: Dataset | None = Dataset.Events,
) -> list[FacetResult]:
    return get_discover_facets(query, snuba_params, referrer, per_page, cursor, Dataset.Events)
