import logging
from collections.abc import Sequence
from datetime import timedelta

from sentry.search.events.types import EventsResponse, ParamsType
from sentry.snuba import discover
from sentry.snuba.dataset import Dataset
from sentry.utils.snuba import SnubaTSResult

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
    on_demand_metrics_enabled=False,
    on_demand_metrics_type=None,
    fallback_to_transactions=False,
) -> EventsResponse:
    return discover.query(
        selected_columns,
        query,
        params,
        snuba_params=snuba_params,
        equations=equations,
        orderby=orderby,
        offset=offset,
        limit=limit,
        referrer=referrer,
        auto_fields=auto_fields,
        auto_aggregations=auto_aggregations,
        include_equation_fields=include_equation_fields,
        allow_metric_aggregates=allow_metric_aggregates,
        use_aggregate_conditions=use_aggregate_conditions,
        conditions=conditions,
        functions_acl=functions_acl,
        transform_alias_to_input_format=transform_alias_to_input_format,
        sample=sample,
        has_metrics=has_metrics,
        use_metrics_layer=use_metrics_layer,
        skip_tag_resolution=skip_tag_resolution,
        extra_columns=extra_columns,
        on_demand_metrics_enabled=on_demand_metrics_enabled,
        on_demand_metrics_type=on_demand_metrics_type,
        dataset=Dataset.Transactions,
        fallback_to_transactions=fallback_to_transactions,
    )


def timeseries_query(
    selected_columns: Sequence[str],
    query: str,
    params: ParamsType,
    rollup: int,
    referrer: str | None = None,
    zerofill_results: bool = True,
    comparison_delta: timedelta | None = None,
    functions_acl: list[str] | None = None,
    allow_metric_aggregates=False,
    has_metrics=False,
    use_metrics_layer=False,
    on_demand_metrics_enabled=False,
    on_demand_metrics_type=None,
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
        zerofill_results=zerofill_results,
        allow_metric_aggregates=allow_metric_aggregates,
        comparison_delta=comparison_delta,
        functions_acl=functions_acl,
        has_metrics=has_metrics,
        use_metrics_layer=use_metrics_layer,
        on_demand_metrics_enabled=on_demand_metrics_enabled,
        on_demand_metrics_type=on_demand_metrics_type,
        dataset=Dataset.Transactions,
    )


def top_events_timeseries(
    timeseries_columns,
    selected_columns,
    user_query,
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
    on_demand_metrics_enabled: bool = False,
    on_demand_metrics_type=None,
):
    return discover.top_events_timeseries(
        timeseries_columns,
        selected_columns,
        user_query,
        params,
        orderby,
        rollup,
        limit,
        organization,
        equations=equations,
        referrer=referrer,
        top_events=top_events,
        allow_empty=allow_empty,
        zerofill_results=zerofill_results,
        include_other=include_other,
        functions_acl=functions_acl,
        on_demand_metrics_enabled=on_demand_metrics_enabled,
        on_demand_metrics_type=on_demand_metrics_type,
        dataset=Dataset.Transactions,
    )
