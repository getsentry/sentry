from copy import deepcopy
from datetime import timedelta
from typing import Dict, List, Optional, Sequence

import sentry_sdk

from sentry.discover.arithmetic import categorize_columns
from sentry.exceptions import InvalidSearchQuery
from sentry.models.group import STATUS_QUERY_CHOICES
from sentry.search.events.builder import ErrorsQueryBuilder
from sentry.search.events.builder.errors import ErrorsTimeseriesQueryBuilder
from sentry.search.events.fields import get_json_meta_type
from sentry.search.events.types import QueryBuilderConfig
from sentry.snuba.dataset import Dataset
from sentry.snuba.discover import EventsResponse, transform_tips, zerofill
from sentry.snuba.metrics.extraction import MetricSpecType
from sentry.utils.snuba import SnubaTSResult, bulk_snql_query

is_filter_translation = {}
for status_key, status_value in STATUS_QUERY_CHOICES.items():
    is_filter_translation[status_key] = ("status", status_value)
PARSER_CONFIG_OVERRIDES = {"is_filter_translation": is_filter_translation}


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
    on_demand_metrics_enabled=False,
    on_demand_metrics_type: Optional[MetricSpecType] = None,
) -> EventsResponse:
    if not selected_columns:
        raise InvalidSearchQuery("No columns selected")

    builder = ErrorsQueryBuilder(
        Dataset.Events,
        params,
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
    result = builder.process_results(builder.run_query(referrer))
    result["meta"]["tips"] = transform_tips(builder.tips)
    return result


def timeseries_query(
    selected_columns: Sequence[str],
    query: str,
    params: Dict[str, str],
    rollup: int,
    referrer: Optional[str] = None,
    zerofill_results: bool = True,
    comparison_delta: Optional[timedelta] = None,
    functions_acl: Optional[List[str]] = None,
    allow_metric_aggregates=False,
    has_metrics=False,
    use_metrics_layer=False,
    on_demand_metrics_enabled=False,
    on_demand_metrics_type: Optional[MetricSpecType] = None,
):
    with sentry_sdk.start_span(op="errors", description="timeseries.filter_transform"):
        equations, columns = categorize_columns(selected_columns)
        base_builder = ErrorsTimeseriesQueryBuilder(
            Dataset.Events,
            params,
            rollup,
            query=query,
            selected_columns=columns,
            equations=equations,
            config=QueryBuilderConfig(
                functions_acl=functions_acl,
                has_metrics=has_metrics,
                parser_config_overrides=PARSER_CONFIG_OVERRIDES,
            ),
        )
        query_list = [base_builder]
        if comparison_delta:
            if len(base_builder.aggregates) != 1:
                raise InvalidSearchQuery("Only one column can be selected for comparison queries")
            comp_query_params = deepcopy(params)
            comp_query_params["start"] -= comparison_delta
            comp_query_params["end"] -= comparison_delta
            comparison_builder = ErrorsTimeseriesQueryBuilder(
                Dataset.Events,
                comp_query_params,
                rollup,
                query=query,
                selected_columns=columns,
                equations=equations,
                config=QueryBuilderConfig(parser_config_overrides=PARSER_CONFIG_OVERRIDES),
            )
            query_list.append(comparison_builder)

        query_results = bulk_snql_query([query.get_snql_query() for query in query_list], referrer)

    with sentry_sdk.start_span(op="errors", description="timeseries.transform_results"):
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
                        time_col_name="events.time",
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
