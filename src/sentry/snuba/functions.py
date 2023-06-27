import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

import sentry_sdk

from sentry.exceptions import InvalidSearchQuery
from sentry.search.events.builder import (
    ProfileFunctionsQueryBuilder,
    ProfileFunctionsTimeseriesQueryBuilder,
    ProfileTopFunctionsTimeseriesQueryBuilder,
)
from sentry.search.events.fields import get_json_meta_type
from sentry.search.events.types import ParamsType, SnubaParams
from sentry.snuba.dataset import Dataset
from sentry.snuba.discover import transform_tips, zerofill
from sentry.utils.snuba import SnubaTSResult

logger = logging.getLogger(__name__)


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
        dataset=Dataset.Functions,
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


def top_events_timeseries(
    timeseries_columns,
    selected_columns,
    query,
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
    result_key_order=None,
):
    assert not include_other, "Other is not supported"  # TODO: support other

    if top_events is None:
        assert top_events, "Need to provide top events"  # TODO: support this use case

    top_functions_builder = ProfileTopFunctionsTimeseriesQueryBuilder(
        dataset=Dataset.Functions,
        params=params,
        interval=rollup,
        top_events=top_events["data"],
        other=False,
        query=query,
        selected_columns=selected_columns,
        timeseries_columns=timeseries_columns,
        equations=equations,
        functions_acl=functions_acl,
        skip_tag_resolution=True,
    )

    if len(top_events["data"]) == limit and include_other:
        assert False, "Other is not supported"  # TODO: support other
    else:
        result = top_functions_builder.run_query(referrer)

    if not allow_empty and not len(result.get("data", [])):
        return SnubaTSResult(
            {
                "data": zerofill([], params["start"], params["end"], rollup, "time")
                if zerofill_results
                else [],
            },
            params["start"],
            params["end"],
            rollup,
        )

    with sentry_sdk.start_span(
        op="discover.discover", description="top_events.transform_results"
    ) as span:
        span.set_data("result_count", len(result.get("data", [])))
        result = top_functions_builder.process_results(result)

        if result_key_order is None:
            result_key_order = top_functions_builder.translated_groupby

        results: Dict[str, Any] = {}

        # Using the top events add the order to the results
        for index, item in enumerate(top_events["data"]):
            result_key = create_result_key(item, result_key_order)
            results[result_key] = {"order": index, "data": []}
        for row in result["data"]:
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
                    "data": zerofill(item["data"], params["start"], params["end"], rollup, "time")
                    if zerofill_results
                    else item["data"],
                    "order": item["order"],
                },
                params["start"],
                params["end"],
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
