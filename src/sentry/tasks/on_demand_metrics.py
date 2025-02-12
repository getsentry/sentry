from __future__ import annotations

import logging
from collections.abc import Sequence

import sentry_sdk
from celery.exceptions import SoftTimeLimitExceeded
from django.utils import timezone

from sentry import options
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
    widget_exceeds_max_specs,
)
from sentry.search.events import fields
from sentry.search.events.builder.discover import DiscoverQueryBuilder
from sentry.search.events.types import EventsResponse, QueryBuilderConfig, SnubaParams
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics.extraction import OnDemandMetricSpecVersioning
from sentry.snuba.referrer import Referrer
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics
from sentry.utils.cache import cache
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger("sentry.tasks.on_demand_metrics")

OnDemandExtractionState = DashboardWidgetQueryOnDemand.OnDemandExtractionState

# TTL for cardinality check
_WIDGET_QUERY_CARDINALITY_TTL = 3600 * 24 * 7  # Cardinality outcome is valid for 7 days.
_COLUMN_CARDINALITY_TTL = 3600  # Cardinality outcome is valid for 1 hour to match the widget check.
TASK_CACHE_KEY = "task-cache"
DASHBOARD_CACHE_KEY = "dashboard-cache"
TASK_QUERY_PERIOD = "30m"
DASHBOARD_QUERY_PERIOD = "1h"


def _get_widget_processing_batch_key() -> str:
    return "on-demand-metrics:widgets:currently-processing-batch"


def _get_project_for_query_cache_key(organization: Organization) -> str:
    return f"on-demand-project-spec:{organization.id}"


def get_field_cardinality_cache_key(
    query_column: str, organization: Organization, widget_cache_key: str
) -> str:
    """widget_cache_key is to differentiate the cache keys between the frontend validating widgets and the task which
    checks if widgets are still valid"""
    return f"check-fields-cardinality:{widget_cache_key}:{organization.id}:{query_column}"


def _set_currently_processing_batch(current_batch: int) -> None:
    cache.set(_get_widget_processing_batch_key(), current_batch, timeout=3600)


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
        DashboardWidgetQuery.objects.filter(
            widget__widget_type__in=[
                DashboardWidgetTypes.DISCOVER,
                DashboardWidgetTypes.TRANSACTION_LIKE,
            ]
        ).values_list("id"),
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
def process_widget_specs(widget_query_ids: list[int], *args: object, **kwargs: object) -> None:
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
    project_for_query = cache.get(_get_project_for_query_cache_key(organization), None)
    if not cache.has_key(_get_project_for_query_cache_key(organization)):
        # This can just be the first project we find, since spec hashes should not be project
        # dependent. If spec hashes become project dependent then this may need to change.
        project_for_query = Project.objects.filter(organization=organization).first()
        cache.set(
            _get_project_for_query_cache_key(organization),
            project_for_query,
            timeout=_COLUMN_CARDINALITY_TTL,
        )

    if not project_for_query:
        return []

    widget_specs = convert_widget_query_to_metric(project_for_query, widget_query, True)

    specs_per_version: dict[int, dict[str, HashedMetricSpec]] = {}
    for hash, spec, spec_version in widget_specs:
        specs_per_version.setdefault(spec_version.version, {})
        specs_per_version[spec_version.version][hash] = (hash, spec, spec_version)

    specs: list[HashedMetricSpec] = []
    for _, _specs_for_version in specs_per_version.items():
        specs += _specs_for_version.values()

    return specs


def _set_widget_on_demand_state(
    widget_query: DashboardWidgetQuery,
    specs: Sequence[HashedMetricSpec],
    is_low_cardinality: bool | None,
    enabled_features: set[str],
) -> None:
    specs_per_version: dict[int, list[HashedMetricSpec]] = {}
    for hash, spec, spec_version in specs:
        specs_per_version.setdefault(spec_version.version, [])
        specs_per_version[spec_version.version].append((hash, spec, spec_version))

    for spec_version in OnDemandMetricSpecVersioning.get_spec_versions():
        version = spec_version.version
        specs_for_version = specs_per_version.get(version, [])
        extraction_state = _determine_extraction_state(specs, is_low_cardinality, enabled_features)
        spec_hashes = [hashed_spec[0] for hashed_spec in specs_for_version]

        (on_demand, _) = DashboardWidgetQueryOnDemand.objects.get_or_create(
            dashboard_widget_query=widget_query,
            spec_version=version,
            defaults={
                "spec_hashes": spec_hashes,
                "extraction_state": extraction_state,
            },
        )

        if on_demand.can_extraction_be_auto_overridden():
            on_demand.extraction_state = extraction_state

        if options.get("on_demand.update_on_demand_modified"):
            # Only temporarily required to check we've updated data on rows the task has passed
            # Or updated to pass the check against widget query date_modified.
            on_demand.date_modified = timezone.now()

        on_demand.spec_hashes = spec_hashes
        on_demand.save()


def set_or_create_on_demand_state(
    widget_query: DashboardWidgetQuery,
    organization: Organization,
    is_low_cardinality: bool,
    feature_enabled: bool,
    current_widget_specs: set[str],
) -> None:
    specs = _get_widget_on_demand_specs(widget_query, organization)

    specs_per_version: dict[int, list[HashedMetricSpec]] = {}
    for hash, spec, spec_version in specs:
        specs_per_version.setdefault(spec_version.version, [])
        specs_per_version[spec_version.version].append((hash, spec, spec_version))

    for spec_version in OnDemandMetricSpecVersioning.get_spec_versions():
        version = spec_version.version
        specs_for_version = specs_per_version.get(version, [])
        if not specs:
            extraction_state = OnDemandExtractionState.DISABLED_NOT_APPLICABLE
        elif widget_exceeds_max_specs(specs, current_widget_specs, organization):
            extraction_state = OnDemandExtractionState.DISABLED_SPEC_LIMIT
        elif not is_low_cardinality:
            extraction_state = OnDemandExtractionState.DISABLED_HIGH_CARDINALITY
        elif not feature_enabled:
            extraction_state = OnDemandExtractionState.DISABLED_PREROLLOUT
        else:
            extraction_state = OnDemandExtractionState.ENABLED_CREATION

        spec_hashes = [hashed_spec[0] for hashed_spec in specs_for_version]

        on_demand, created = DashboardWidgetQueryOnDemand.objects.get_or_create(
            dashboard_widget_query=widget_query,
            spec_version=version,
            defaults={
                "spec_hashes": spec_hashes,
                "extraction_state": extraction_state,
            },
        )

        if not created:
            on_demand.spec_hashes = spec_hashes
            on_demand.extraction_state = extraction_state
            on_demand.save()


def _determine_extraction_state(
    specs: Sequence[HashedMetricSpec], is_low_cardinality: bool | None, enabled_features: set[str]
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
) -> bool | None:
    """
    Checks cardinality of existing widget queries before allowing the metric spec, so that
    group-by clauses with high cardinality tags are not added to the on_demand metric.

    New queries will be checked upon creation and not allowed at that time.
    """

    query_columns = widget_query.columns
    max_cardinality_allowed = options.get("on_demand.max_widget_cardinality.count")

    field_cardinality = check_field_cardinality(
        query_columns,
        organization,
        max_cardinality_allowed,
        is_task=True,
        widget_query=widget_query,
    )
    return all(field_cardinality.values())


@sentry_sdk.tracing.trace
def check_field_cardinality(
    query_columns: list[str] | None,
    organization: Organization,
    max_cardinality: int,
    is_task: bool = False,
    widget_query: DashboardWidgetQuery | None = None,
) -> dict[str, str]:
    if not query_columns:
        return {}
    if is_task:
        cache_identifier = TASK_CACHE_KEY
        cache_ttl = _WIDGET_QUERY_CARDINALITY_TTL
        period = TASK_QUERY_PERIOD
        assert widget_query is not None, "widget_query is a required param"
    else:
        cache_identifier = DASHBOARD_CACHE_KEY
        cache_ttl = _COLUMN_CARDINALITY_TTL
        period = DASHBOARD_QUERY_PERIOD

    # We cache each key individually to query less
    cache_keys: dict[str, str] = {}
    for column in query_columns:
        column_cache_key = get_field_cardinality_cache_key(column, organization, cache_identifier)
        cache_keys[column] = column_cache_key
    cardinality_map = cache.get_many(cache_keys.values())
    if len(cardinality_map) == len(query_columns):
        return cardinality_map

    query_columns = [col for col, key in cache_keys.items() if key not in cardinality_map]

    with sentry_sdk.isolation_scope() as scope:
        if widget_query:
            scope.set_tag("widget_query.widget_id", widget_query.id)
            scope.set_tag("widget_query.org_slug", organization.slug)
            scope.set_tag("widget_query.conditions", widget_query.conditions)
        else:
            scope.set_tag("cardinality_check.org_slug", organization.slug)

        try:
            processed_results, columns_to_check = _query_cardinality(
                query_columns, organization, period
            )
            for column in query_columns:
                count = processed_results["data"][0][f"count_unique({column})"]
                column_low_cardinality = count <= max_cardinality
                cardinality_map[cache_keys[column]] = column_low_cardinality

                if not column_low_cardinality:
                    scope.set_tag("widget_query.column_name", column)
                    if widget_query:
                        sentry_sdk.capture_exception(
                            HighCardinalityWidgetException(
                                f"Cardinality exceeded for dashboard_widget_query:{widget_query.id} with count:{count} and column:{column}"
                            )
                        )
        except SoftTimeLimitExceeded as error:
            scope.set_tag("widget_soft_deadline", True)
            sentry_sdk.capture_exception(error)
        except Exception as error:
            sentry_sdk.capture_exception(error)

    cache.set_many(cardinality_map, timeout=cache_ttl)
    # assume that columns are low cardinality if we fail to retrieve it for some reason
    return {key: cardinality_map.get(value, True) for key, value in cache_keys.items()}


@sentry_sdk.tracing.trace
def _query_cardinality(
    query_columns: list[str], organization: Organization, period: str = "30m"
) -> tuple[EventsResponse, list[str]]:
    # Restrict period down to an allowlist so we're not slamming snuba with giant queries
    if period not in [TASK_QUERY_PERIOD, DASHBOARD_QUERY_PERIOD]:
        raise Exception("Cardinality can only be queried with 1h or 30m")
    params = SnubaParams(
        stats_period=period,
        organization=organization,
        projects=list(Project.objects.filter(organization=organization)),
    )

    columns_to_check = [column for column in query_columns if not fields.is_function(column)]
    unique_columns = [f"count_unique({column})" for column in columns_to_check]

    query_builder = DiscoverQueryBuilder(
        dataset=Dataset.Discover,
        params={},
        snuba_params=params,
        selected_columns=unique_columns,
        config=QueryBuilderConfig(
            transform_alias_to_input_format=True,
        ),
    )

    results = query_builder.run_query(Referrer.METRIC_EXTRACTION_CARDINALITY_CHECK.value)
    processed_results = query_builder.process_results(results)

    return processed_results, columns_to_check
