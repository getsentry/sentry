import logging
from collections.abc import Sequence
from datetime import timedelta

from snuba_sdk import Column, Condition

from sentry.models.organization import Organization
from sentry.search.events.types import EventsResponse, SnubaParams
from sentry.snuba import discover
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics.extraction import MetricSpecType
from sentry.snuba.query_sources import QuerySource
from sentry.utils.snuba import SnubaTSResult

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
    dataset: Dataset = Dataset.Discover,
    fallback_to_transactions: bool = False,
    query_source: QuerySource | None = None,
) -> EventsResponse:
    return discover.query(
        selected_columns,
        query,
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
        query_source=query_source,
    )


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
    on_demand_metrics_type=None,
    query_source: QuerySource | None = None,
    fallback_to_transactions: bool = False,
    transform_alias_to_input_format: bool = False,
) -> SnubaTSResult:
    """
    High-level API for doing arbitrary user timeseries queries against events.
    this API should match that of sentry.snuba.discover.timeseries_query
    """
    return discover.timeseries_query(
        selected_columns,
        query,
        snuba_params,
        rollup,
        referrer=referrer,
        zerofill_results=zerofill_results,
        allow_metric_aggregates=allow_metric_aggregates,
        comparison_delta=comparison_delta,
        functions_acl=functions_acl,
        has_metrics=has_metrics,
        use_metrics_layer=use_metrics_layer,
        on_demand_metrics_enabled=on_demand_metrics_enabled,
        on_demand_metrics_type=on_demand_metrics_type,
        dataset=Dataset.Transactions,
        query_source=query_source,
        transform_alias_to_input_format=transform_alias_to_input_format,
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
    query_source: QuerySource | None = None,
    fallback_to_transactions: bool = False,
) -> dict[str, SnubaTSResult] | SnubaTSResult:
    return discover.top_events_timeseries(
        timeseries_columns,
        selected_columns,
        user_query,
        snuba_params,
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
        query_source=query_source,
    )


def get_facets(
    query: str | None,
    snuba_params: SnubaParams,
    referrer: str,
    per_page: int | None = discover.TOP_KEYS_DEFAULT_LIMIT,
    cursor: int | None = 0,
    dataset: Dataset | None = Dataset.Transactions,
) -> list[discover.FacetResult]:
    return discover.get_facets(
        query, snuba_params, referrer, per_page, cursor, Dataset.Transactions
    )
