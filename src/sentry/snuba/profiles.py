from datetime import datetime
from typing import Any

from sentry.exceptions import InvalidSearchQuery
from sentry.search.events.builder.profiles import (
    ProfilesQueryBuilder,
    ProfilesTimeseriesQueryBuilder,
)
from sentry.search.events.types import QueryBuilderConfig, SnubaParams
from sentry.snuba.dataset import Dataset
from sentry.snuba.discover import transform_tips, zerofill
from sentry.snuba.metrics.extraction import MetricSpecType
from sentry.snuba.query_sources import QuerySource
from sentry.utils.snuba import SnubaTSResult


def query(
    selected_columns: list[str],
    query: str | None,
    snuba_params: SnubaParams,
    equations: list[str] | None = None,
    orderby: list[str] | None = None,
    offset: int = 0,
    limit: int = 50,
    referrer: str = "",
    auto_fields: bool = False,
    auto_aggregations: bool = False,
    use_aggregate_conditions: bool = False,
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

    builder = ProfilesQueryBuilder(
        dataset=Dataset.Profiles,
        params={},
        query=query,
        snuba_params=snuba_params,
        selected_columns=selected_columns,
        orderby=orderby,
        limit=limit,
        offset=offset,
        config=QueryBuilderConfig(
            auto_fields=auto_fields,
            auto_aggregations=auto_aggregations,
            use_aggregate_conditions=use_aggregate_conditions,
            transform_alias_to_input_format=transform_alias_to_input_format,
            functions_acl=functions_acl,
        ),
    )
    result = builder.process_results(builder.run_query(referrer, query_source=query_source))
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
    builder = ProfilesTimeseriesQueryBuilder(
        dataset=Dataset.Profiles,
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
