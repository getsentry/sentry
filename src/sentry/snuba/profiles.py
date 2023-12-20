from datetime import datetime
from typing import Any, List, Optional

from sentry.exceptions import InvalidSearchQuery
from sentry.search.events.builder import ProfilesQueryBuilder, ProfilesTimeseriesQueryBuilder
from sentry.search.events.fields import get_json_meta_type
from sentry.search.events.types import ParamsType, QueryBuilderConfig, SnubaParams
from sentry.snuba.dataset import Dataset
from sentry.snuba.discover import transform_tips, zerofill
from sentry.snuba.metrics.extraction import MetricSpecType
from sentry.utils.snuba import SnubaTSResult


def query(
    selected_columns: List[str],
    query: Optional[str],
    params: ParamsType,
    snuba_params: Optional[SnubaParams] = None,
    equations: Optional[List[str]] = None,
    orderby: Optional[List[str]] = None,
    offset: int = 0,
    limit: int = 50,
    referrer: str = "",
    auto_fields: bool = False,
    auto_aggregations: bool = False,
    use_aggregate_conditions: bool = False,
    allow_metric_aggregates: bool = False,
    transform_alias_to_input_format: bool = False,
    has_metrics: bool = False,
    functions_acl: Optional[List[str]] = None,
    use_metrics_layer: bool = False,
    on_demand_metrics_enabled: bool = False,
    on_demand_metrics_type: Optional[MetricSpecType] = None,
) -> Any:
    if not selected_columns:
        raise InvalidSearchQuery("No columns selected")

    builder = ProfilesQueryBuilder(
        dataset=Dataset.Profiles,
        params=params,
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
    result = builder.process_results(builder.run_query(referrer))
    result["meta"]["tips"] = transform_tips(builder.tips)
    return result


def timeseries_query(
    selected_columns: List[str],
    query: Optional[str],
    params: ParamsType,
    rollup: int,
    referrer: str = "",
    zerofill_results: bool = True,
    comparison_delta: Optional[datetime] = None,
    functions_acl: Optional[List[str]] = None,
    allow_metric_aggregates: bool = False,
    has_metrics: bool = False,
    use_metrics_layer: bool = False,
    on_demand_metrics_enabled: bool = False,
    on_demand_metrics_type: Optional[MetricSpecType] = None,
) -> Any:
    builder = ProfilesTimeseriesQueryBuilder(
        dataset=Dataset.Profiles,
        params=params,
        query=query,
        interval=rollup,
        selected_columns=selected_columns,
        config=QueryBuilderConfig(
            functions_acl=functions_acl,
        ),
    )
    results = builder.run_query(referrer)

    return SnubaTSResult(
        {
            "data": zerofill(
                results["data"],
                params["start"],
                params["end"],
                rollup,
                "time",
            )
            if zerofill_results
            else results["data"],
            "meta": {
                "fields": {
                    value["name"]: get_json_meta_type(value["name"], value.get("type"), builder)
                    for value in results["meta"]
                }
            },
        },
        params["start"],
        params["end"],
        rollup,
    )
