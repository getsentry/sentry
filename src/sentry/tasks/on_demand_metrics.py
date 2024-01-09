from __future__ import annotations

import logging
from typing import Any, Optional, Sequence, Set

import sentry_sdk
from celery.exceptions import SoftTimeLimitExceeded

from sentry import options
from sentry.api.utils import get_date_range_from_params
from sentry.models.dashboard_widget import (
    DashboardWidgetQuery,
    DashboardWidgetQueryOnDemand,
    DashboardWidgetTypes,
)
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.relay.config.metric_extraction import (
    HashedMetricSpec,
    convert_widget_query_to_metric,
    on_demand_metrics_feature_flags,
)
from sentry.search.events import fields
from sentry.search.events.builder import QueryBuilder
from sentry.search.events.types import EventsResponse, QueryBuilderConfig
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics
from sentry.utils.cache import cache
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger("sentry.tasks.on_demand_metrics")

OnDemandExtractionState = DashboardWidgetQueryOnDemand.OnDemandExtractionState

# TTL for cardinality check
_WIDGET_QUERY_CARDINALITY_TTL = 3600 * 24 * 7  # Cardinality outcome is valid for 7 days.


def _get_widget_processing_batch_key() -> str:
    return "on-demand-metrics:widgets:currently-processing-batch"


def _get_widget_query_cardinality_cache_key(widget_query: DashboardWidgetQuery) -> str:
    return f"check-widget-query-cardinality:{widget_query.id}"


def _set_currently_processing_batch(current_batch: int) -> None:
    cache.set(_get_widget_processing_batch_key(), current_batch, timeout=3600)


def _set_cardinality_cache(cache_key: str, is_low_cardinality: bool) -> None:
    cache.set(cache_key, is_low_cardinality, timeout=_WIDGET_QUERY_CARDINALITY_TTL)


def _get_previous_processing_batch() -> int:
    return cache.get(_get_widget_processing_batch_key(), 0)


def _get_current_processing_batch(total_batches: int) -> int:
    previous_batch = _get_previous_processing_batch()
    current_batch = (previous_batch + 1) % total_batches
    return current_batch


def _get_batch_for_widget_query(widget_query_id: int, total_batches: int) -> int:
    return widget_query_id % total_batches


class HighCardinalityWidgetException(Exception):
    pass


@instrumented_task(
    name="sentry.tasks.on_demand_metrics.schedule_on_demand_check",
    queue="on_demand_metrics",
    max_retries=0,
    soft_time_limit=60,
    time_limit=120,
    expires=180,
)
def schedule_on_demand_check() -> None:
    """
    # Summary
    This task schedules work to be done to check cardinality in group-by columns in dashboard widgets,
    offloading it from `build_project_config` in the relay task (specifically in :func:`sentry.relay.config.metric_extraction.get_metric_extraction_config`).

    Spawns a series of child tasks :func:`process_widget_specs`, and limits them using
    a stateful (cached) count + modulo to spread out the work over `total_batches` number of scheduled task runs.

    It's safe, but not ideal if a particular child tasks fails to run in cases where the current state is reset since memcache is ephemeral.

    ### Other
    - The amount of work being done can be reduced once extraction is stateful in our db, which would allow us to
        only iterate over widgets with currently enabled extraction.

    # Ops
    Killswitch option: `on_demand_metrics.check_widgets.enable`
    - It is safe to turn off for a period of `_WIDGET_QUERY_CARDINALITY_TTL`, customer data should not be lost. After this time
        high cardinality metrics may inadverently be stored for on-demand-extraction.
    """
    if not options.get("on_demand_metrics.check_widgets.enable"):
        return

    rollout = options.get("on_demand_metrics.check_widgets.rollout")
    total_batches = options.get("on_demand_metrics.check_widgets.query.total_batches")
    widgets_per_batch = options.get("on_demand_metrics.check_widgets.query.batch_size")

    currently_processing_batch = _get_current_processing_batch(total_batches)

    widget_query_ids = []
    dashboard_widget_pre_rollout_count = 0
    dashboard_widget_count = 0

    for (widget_query_id,) in RangeQuerySetWrapper(
        DashboardWidgetQuery.objects.filter(widget__widget_type=DashboardWidgetTypes.DISCOVER)
        .exclude(conditions__contains="event.type:error")
        .values_list("id"),
        result_value_getter=lambda item: item[0],
    ):
        dashboard_widget_pre_rollout_count += 1

        if ((widget_query_id % 1_000) / 1_000) > rollout:
            # % rollout based on widget_id accurate to 0.1%
            continue

        batch_for_widget_query = _get_batch_for_widget_query(widget_query_id, total_batches)
        if batch_for_widget_query != currently_processing_batch:
            continue

        widget_query_ids.append(widget_query_id)
        dashboard_widget_count += 1

        if len(widget_query_ids) >= widgets_per_batch:
            process_widget_specs.delay(
                widget_query_ids,
            )
            widget_query_ids = []

    # Clean up any remaining widgets
    if widget_query_ids:
        process_widget_specs.delay(
            widget_query_ids,
        )

    _set_currently_processing_batch(currently_processing_batch)
    metrics.incr(
        "task.on_demand_metrics.widgets.currently_processing_batch",
        amount=currently_processing_batch,  # Helps correlate which batch is currently being processed with metrics
        sample_rate=1.0,
    )
    metrics.incr(
        "task.on_demand_metrics.widgets.pre_rollout.total",
        amount=dashboard_widget_pre_rollout_count,
        sample_rate=1.0,
    )
    metrics.incr(
        "task.on_demand_metrics.widgets.total",
        amount=dashboard_widget_count,
        sample_rate=1.0,
    )


@instrumented_task(
    name="sentry.tasks.on_demand_metrics.process_widget_specs",
    queue="on_demand_metrics",
    max_retries=0,
    soft_time_limit=60,
    time_limit=120,
    expires=180,
)
def process_widget_specs(widget_query_ids: list[int], *args, **kwargs) -> None:
    """
    Child task spawned from :func:`schedule_on_demand_check`.
    """
    if not options.get("on_demand_metrics.check_widgets.enable"):
        return

    widget_query_count = 0
    widget_query_high_cardinality_count = 0
    widget_query_no_spec_count = 0

    for query in DashboardWidgetQuery.objects.filter(id__in=widget_query_ids).select_related(
        "widget__dashboard__organization"
    ):
        organization = query.widget.dashboard.organization
        enabled_features = on_demand_metrics_feature_flags(organization)
        widget_query_count += 1

        widget_specs = _get_widget_on_demand_specs(query, organization)

        if not widget_specs:
            # It's possible this query doesn't qualify for on-demand.
            widget_query_no_spec_count += 1

        is_low_cardinality = None
        # This only exists to make sure we're 1:1 with flagr since we're not fully rolled out.
        # TODO: Remove feature flag check once we've checked metrics have gone to 0.
        if "organizations:on-demand-metrics-extraction-widgets" in enabled_features:
            if widget_specs:
                is_low_cardinality = _get_widget_query_low_cardinality(query, organization)
                if is_low_cardinality is not None:
                    # Still setting to cache for now until switching cardinality out of build_project_config
                    cache_key = _get_widget_query_cardinality_cache_key(query)
                    _set_cardinality_cache(cache_key, is_low_cardinality)
                if is_low_cardinality is False:
                    widget_query_high_cardinality_count += 1
        else:
            metrics.incr(
                "task.on_demand_metrics.widget_queries.per_run.flag_disabled",
                sample_rate=1.0,
            )

        _set_widget_on_demand_state(
            widget_query=query,
            specs=widget_specs,
            is_low_cardinality=is_low_cardinality,
            enabled_features=enabled_features,
        )

    metrics.incr(
        "tasks.on_demand_metrics.widget_queries.per_run.no_spec",
        amount=widget_query_no_spec_count,
        sample_rate=1.0,
    )
    metrics.incr(
        "task.on_demand_metrics.widget_queries.per_run.high_cardinality",
        amount=widget_query_high_cardinality_count,
        sample_rate=1.0,
    )
    metrics.incr(
        "task.on_demand_metrics.widget_queries.per_run.total",
        amount=widget_query_count,
        sample_rate=1.0,
    )


def _get_widget_on_demand_specs(
    widget_query: DashboardWidgetQuery,
    organization: Organization,
) -> Sequence[HashedMetricSpec]:
    """
    Saves on-demand state for a widget query.
    """
    # This can just be the first project we find, since spec hashes should not be project
    # dependent. If spec hashes become project dependent then this may need to change.
    project_for_query = Project.objects.filter(organization=organization).first()

    if not project_for_query:
        return []

    widget_specs = convert_widget_query_to_metric(project_for_query, widget_query, True)

    return widget_specs


def _set_widget_on_demand_state(
    widget_query: DashboardWidgetQuery,
    specs: Sequence[HashedMetricSpec],
    is_low_cardinality: bool | None,
    enabled_features: Set[str],
):
    extraction_state = _determine_extraction_state(specs, is_low_cardinality, enabled_features)
    spec_hashes = [hashed_spec[0] for hashed_spec in specs]

    DashboardWidgetQueryOnDemand.objects.update_or_create(
        dashboard_widget_query=widget_query,
        defaults={
            "spec_hashes": spec_hashes,
            "extraction_state": extraction_state,
        },
    )


def _determine_extraction_state(
    specs: Sequence[HashedMetricSpec], is_low_cardinality: bool | None, enabled_features: Set[str]
) -> OnDemandExtractionState:
    if not specs:
        return OnDemandExtractionState.DISABLED_NOT_APPLICABLE

    if "organizations:on-demand-metrics-extraction-widgets" not in enabled_features:
        return OnDemandExtractionState.DISABLED_PREROLLOUT

    if is_low_cardinality is False:
        return OnDemandExtractionState.DISABLED_HIGH_CARDINALITY

    return OnDemandExtractionState.ENABLED_ENROLLED


def _get_widget_query_low_cardinality(
    widget_query: DashboardWidgetQuery, organization: Organization
) -> Optional[bool]:
    """
    Checks cardinality of existing widget queries before allowing the metric spec, so that
    group-by clauses with high cardinality tags are not added to the on_demand metric.

    New queries will be checked upon creation and not allowed at that time.
    """

    max_cardinality_allowed = options.get("on_demand.max_widget_cardinality.count")
    cache_key = _get_widget_query_cardinality_cache_key(widget_query)

    # We default low cardinality to true since if it's false we'll remove user data.
    is_low_cardinality = cache.get(cache_key, default=True)
    query_columns = widget_query.columns

    if not query_columns:

        return None

    with sentry_sdk.push_scope() as scope:
        scope.set_tag("widget_query.widget_id", widget_query.id)
        scope.set_tag("widget_query.org_slug", organization.slug)
        scope.set_tag("widget_query.conditions", widget_query.conditions)

        try:
            processed_results, columns_to_check = _query_cardinality(query_columns, organization)
            for column in columns_to_check:
                count = processed_results["data"][0][f"count_unique({column})"]
                if count > max_cardinality_allowed:
                    cache.set(cache_key, False, timeout=_WIDGET_QUERY_CARDINALITY_TTL)
                    scope.set_tag("widget_query.column_name", column)
                    raise HighCardinalityWidgetException(
                        f"Cardinality exceeded for dashboard_widget_query:{widget_query.id} with count:{count} and column:{column}"
                    )
            # If it's made it here then cardinality is low.
            is_low_cardinality = True

        except HighCardinalityWidgetException as error:
            sentry_sdk.capture_exception(error)
            is_low_cardinality = False
        except SoftTimeLimitExceeded as error:
            scope.set_tag("widget_soft_deadline", True)
            sentry_sdk.capture_exception(error)
        except Exception as error:
            sentry_sdk.capture_exception(error)

    return is_low_cardinality


def _query_cardinality(
    query_columns: list[str], organization: Organization
) -> tuple[EventsResponse, list[str]]:
    params: dict[str, Any] = {
        "statsPeriod": "30m",
        "organization_id": organization.id,
    }
    start, end = get_date_range_from_params(params)
    params["start"] = start
    params["end"] = end

    columns_to_check = [column for column in query_columns if not fields.is_function(column)]
    unique_columns = [f"count_unique({column})" for column in columns_to_check]

    query_builder = QueryBuilder(
        dataset=Dataset.Discover,
        params=params,
        selected_columns=unique_columns,
        config=QueryBuilderConfig(
            transform_alias_to_input_format=True,
        ),
    )

    results = query_builder.run_query(Referrer.METRIC_EXTRACTION_CARDINALITY_CHECK.value)
    processed_results = query_builder.process_results(results)

    return processed_results, columns_to_check
