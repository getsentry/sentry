from datetime import timedelta
from typing import Dict, List, Optional, Sequence

import sentry_sdk

from sentry.discover.arithmetic import categorize_columns
from sentry.search.events.builder import SpansIndexedQueryBuilder, TimeseriesSpanIndexedQueryBuilder
from sentry.snuba import discover
from sentry.utils.snuba import Dataset, SnubaTSResult


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

    with sentry_sdk.start_span(op="mep", description="TimeseriesSpanIndexedQueryBuilder"):
        query = TimeseriesSpanIndexedQueryBuilder(
            Dataset.SpansIndexed,
            params,
            rollup,
            query=query,
            selected_columns=columns,
            functions_acl=functions_acl,
        )
        result = query.run_query(referrer)
    with sentry_sdk.start_span(op="mep", description="query.transform_results"):
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
