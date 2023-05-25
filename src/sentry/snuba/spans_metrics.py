import logging
from datetime import timedelta
from typing import Dict, List, Optional, Sequence

from snuba_sdk import Column

from sentry.search.events.builder import (
    SpansMetricsQueryBuilder,
    TimeseriesSpansMetricsQueryBuilder,
)
from sentry.snuba import discover
from sentry.utils.snuba import Dataset, SnubaTSResult

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
    builder = SpansMetricsQueryBuilder(
        dataset=Dataset.PerformanceMetrics,
        params=params,
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
    groupby: Optional[Column] = None,
) -> SnubaTSResult:
    """
    High-level API for doing arbitrary user timeseries queries against events.
    this API should match that of sentry.snuba.discover.timeseries_query
    """
    metrics_query = TimeseriesSpansMetricsQueryBuilder(
        params,
        rollup,
        dataset=Dataset.PerformanceMetrics,
        query=query,
        selected_columns=selected_columns,
        functions_acl=functions_acl,
        allow_metric_aggregates=allow_metric_aggregates,
        use_metrics_layer=use_metrics_layer,
        groupby=groupby,
    )
    result = metrics_query.run_query(referrer)

    result = metrics_query.process_results(result)
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

    result["meta"]["isMetricsData"] = True

    return SnubaTSResult(
        {
            "data": result["data"],
            "isMetricsData": True,
            "meta": result["meta"],
        },
        params["start"],
        params["end"],
        rollup,
    )
