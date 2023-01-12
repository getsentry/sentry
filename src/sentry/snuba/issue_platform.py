from datetime import timedelta
from typing import Dict, List, Optional, Sequence

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
    use_aggregate_conditions=False,
    allow_metric_aggregates=True,
    conditions=None,
    functions_acl=None,
    dry_run=False,
    transform_alias_to_input_format=False,
    has_metrics: bool = True,
    use_metrics_layer: bool = False,
):
    return discover.query(
        selected_columns,
        query,
        params,
        equations=equations,
        orderby=orderby,
        offset=offset,
        limit=limit,
        referrer=referrer,
        auto_fields=auto_fields,
        auto_aggregations=auto_aggregations,
        use_aggregate_conditions=use_aggregate_conditions,
        conditions=conditions,
        functions_acl=functions_acl,
        transform_alias_to_input_format=transform_alias_to_input_format,
        has_metrics=has_metrics,
        dataset=Dataset.IssuePlatform,
    )


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
    dry_run: bool = False,
    has_metrics: bool = True,
    use_metrics_layer: bool = False,
) -> SnubaTSResult:
    """
    High-level API for doing arbitrary user timeseries queries against events.
    this API should match that of sentry.snuba.discover.timeseries_query
    """
    return discover.timeseries_query(
        selected_columns,
        query,
        params,
        rollup,
        referrer,
        zerofill_results,
        comparison_delta,
        functions_acl,
        has_metrics=has_metrics,
        dataset=Dataset.IssuePlatform,
    )
