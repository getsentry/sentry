from datetime import datetime
from typing import Any, List, Optional

from sentry.search.events.builder import (
    ProfileFunctionsQueryBuilder,
    ProfileFunctionsTimeseriesQueryBuilder,
)
from sentry.search.events.fields import InvalidSearchQuery, get_json_meta_type
from sentry.search.events.types import ParamsType, SnubaParams
from sentry.snuba.discover import transform_tips, zerofill
from sentry.utils.snuba import Dataset, SnubaTSResult


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
) -> Any:
    if not selected_columns:
        raise InvalidSearchQuery("No columns selected")

    builder = ProfileFunctionsQueryBuilder(
        dataset=Dataset.Functions,
        params=params,
        query=query,
        snuba_params=snuba_params,
        selected_columns=selected_columns,
        orderby=orderby,
        auto_fields=False,
        auto_aggregations=auto_aggregations,
        use_aggregate_conditions=use_aggregate_conditions,
        transform_alias_to_input_format=transform_alias_to_input_format,
        functions_acl=functions_acl,
        limit=limit,
        offset=offset,
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
) -> Any:
    builder = ProfileFunctionsTimeseriesQueryBuilder(
        dataset=Dataset.Profiles,
        params=params,
        query=query,
        interval=rollup,
        selected_columns=selected_columns,
        functions_acl=functions_acl,
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
