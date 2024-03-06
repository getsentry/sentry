import logging
import random
from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import timedelta
from typing import Any, Literal, TypedDict

import sentry_sdk
from celery.exceptions import SoftTimeLimitExceeded
from django.utils import timezone
from sentry_relay.processing import validate_sampling_condition

from sentry import features, options
from sentry.api.endpoints.project_transaction_threshold import DEFAULT_THRESHOLD
from sentry.api.utils import get_date_range_from_params
from sentry.incidents.temp_model import AlertRule, AlertRuleStatus
from sentry.models.dashboard_widget import (
    ON_DEMAND_ENABLED_KEY,
    DashboardWidgetQuery,
    DashboardWidgetQueryOnDemand,
    DashboardWidgetTypes,
)
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.transaction_threshold import (
    ProjectTransactionThreshold,
    ProjectTransactionThresholdOverride,
    TransactionMetric,
)
from sentry.search.events import fields
from sentry.search.events.builder import QueryBuilder
from sentry.search.events.types import ParamsType, QueryBuilderConfig
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics.extraction import (
    MetricSpec,
    MetricSpecType,
    OnDemandMetricSpec,
    OnDemandMetricSpecVersioning,
    RuleCondition,
    SpecVersion,
    are_specs_equal,
    should_use_on_demand_metrics,
)
from sentry.snuba.models import SnubaQuery
from sentry.snuba.referrer import Referrer
from sentry.utils import json, metrics
from sentry.utils.cache import cache

OnDemandExtractionState = DashboardWidgetQueryOnDemand.OnDemandExtractionState

logger = logging.getLogger(__name__)

# GENERIC METRIC EXTRACTION

# Version of the metric extraction config.
_METRIC_EXTRACTION_VERSION = 2

# Maximum number of custom metrics that can be extracted for alerts and widgets with
# advanced filter expressions.
_MAX_ON_DEMAND_ALERTS = 50

# TTL for cardinality check
_WIDGET_QUERY_CARDINALITY_TTL = 3600 * 24  # 24h
_WIDGET_QUERY_CARDINALITY_SOFT_DEADLINE_TTL = 3600 * 0.5  # 30m

HashedMetricSpec = tuple[str, MetricSpec, SpecVersion]


class HighCardinalityWidgetException(Exception):
    pass


class MetricExtractionConfig(TypedDict):
    """Configuration for generic extraction of metrics from all data categories."""

    version: int
    metrics: list[MetricSpec]


def get_max_widget_specs(organization: Organization) -> int:
    if organization.id in options.get("on_demand.extended_widget_spec_orgs") and options.get(
        "on_demand.extended_max_widget_specs"
    ):
        return options.get("on_demand.extended_max_widget_specs")

    max_widget_specs = options.get("on_demand.max_widget_specs")
    return max_widget_specs


@metrics.wraps("on_demand_metrics.get_metric_extraction_config")
def get_metric_extraction_config(project: Project) -> MetricExtractionConfig | None:
    """
    Returns generic metric extraction config for the given project.

    This requires respective feature flags to be enabled. At the moment, metrics
    for the following models are extracted:
     - Performance alert rules with advanced filter expressions.
     - On-demand metrics widgets.
    """
    # For efficiency purposes, we fetch the flags in batch and propagate them downstream.
    enabled_features = on_demand_metrics_feature_flags(project.organization)
    sentry_sdk.set_tag("organization_id", project.organization_id)

    prefilling = "organizations:on-demand-metrics-prefill" in enabled_features

    alert_specs = _get_alert_metric_specs(project, enabled_features, prefilling)
    widget_specs = _get_widget_metric_specs(project, enabled_features, prefilling)

    metric_specs = _merge_metric_specs(alert_specs, widget_specs)
    if not metric_specs:
        return None

    return {
        "version": _METRIC_EXTRACTION_VERSION,
        "metrics": metric_specs,
    }


def on_demand_metrics_feature_flags(organization: Organization) -> set[str]:
    feature_names = [
        "organizations:on-demand-metrics-extraction",
        "organizations:on-demand-metrics-extraction-widgets",  # Controls extraction for widgets
        "organizations:on-demand-metrics-extraction-experimental",
        "organizations:on-demand-metrics-prefill",
    ]

    enabled_features = set()
    for feature in feature_names:
        if features.has(feature, organization=organization):
            enabled_features.add(feature)

    return enabled_features


@metrics.wraps("on_demand_metrics._get_alert_metric_specs")
def _get_alert_metric_specs(
    project: Project, enabled_features: set[str], prefilling: bool
) -> list[HashedMetricSpec]:
    if not ("organizations:on-demand-metrics-extraction" in enabled_features or prefilling):
        return []

    metrics.incr(
        "on_demand_metrics.get_alerts",
        tags={"prefilling": prefilling},
    )

    datasets = [Dataset.PerformanceMetrics.value]
    if prefilling:
        datasets.append(Dataset.Transactions.value)

    alert_rules = (
        AlertRule.objects.fetch_for_project(project)
        .filter(
            organization=project.organization,
            status=AlertRuleStatus.PENDING.value,
            snuba_query__dataset__in=datasets,
        )
        .select_related("snuba_query")
    )

    specs = []
    with metrics.timer("on_demand_metrics.alert_spec_convert"):
        for alert in alert_rules:
            alert_snuba_query = alert.snuba_query
            metrics.incr(
                "on_demand_metrics.before_alert_spec_generation",
                tags={"prefilling": prefilling, "dataset": alert_snuba_query.dataset},
            )

            if results := _convert_snuba_query_to_metrics(project, alert_snuba_query, prefilling):
                for spec in results:
                    _log_on_demand_metric_spec(
                        project_id=project.id,
                        spec_for="alert",
                        spec=spec,
                        id=alert.id,
                        field=alert_snuba_query.aggregate,
                        query=alert_snuba_query.query,
                        prefilling=prefilling,
                    )
                    metrics.incr(
                        "on_demand_metrics.on_demand_spec.for_alert",
                        tags={"prefilling": prefilling},
                    )
                    specs.append(spec)

    max_alert_specs = options.get("on_demand.max_alert_specs") or _MAX_ON_DEMAND_ALERTS
    (specs, _) = _trim_if_above_limit(specs, max_alert_specs, project, "alerts")

    return specs


@metrics.wraps("on_demand_metrics._get_widget_metric_specs")
def _get_widget_metric_specs(
    project: Project, enabled_features: set[str], prefilling: bool
) -> list[HashedMetricSpec]:
    if "organizations:on-demand-metrics-extraction-widgets" not in enabled_features:
        metrics.incr("on_demand_metrics.get_widget_metric_specs.extraction_feature_disabled")
        return []

    metrics.incr(
        "on_demand_metrics.get_widgets",
        tags={"prefilling": prefilling},
    )

    # fetch all queries of all on demand metrics widgets of this organization
    widget_queries = (
        DashboardWidgetQuery.objects.filter(
            widget__dashboard__organization=project.organization,
            widget__widget_type=DashboardWidgetTypes.DISCOVER,
        )
        .prefetch_related("dashboardwidgetqueryondemand_set", "widget")
        .order_by("-widget__dashboard__last_visited", "widget__order")
    )

    metrics.incr(
        "on_demand_metrics.widgets_to_process", amount=len(widget_queries), sample_rate=1.0
    )

    ignored_widget_ids: dict[int, bool] = {}
    specs_for_widget: dict[int, list[HashedMetricSpec]] = defaultdict(list)
    widget_query_for_spec_hash: dict[str, DashboardWidgetQuery] = {}
    specs: list[HashedMetricSpec] = []

    total_spec_count = 0

    with metrics.timer("on_demand_metrics.widget_spec_convert"):
        for widget_query in widget_queries:
            widget_specs = convert_widget_query_to_metric(project, widget_query, prefilling)

            if not widget_specs:
                # Skip checking any widget queries that don't have specs,
                # they don't affect decisions about the widget.
                continue

            total_spec_count += 1
            specs_for_widget[widget_query.widget.id] += widget_specs
            for spec in widget_specs:
                widget_query_for_spec_hash[spec[0]] = widget_query

            can_widget_query_use_stateful_extraction = _can_widget_query_use_stateful_extraction(
                widget_query, widget_specs
            )

            if options.get("on_demand_metrics.widgets.use_stateful_extraction"):
                if can_widget_query_use_stateful_extraction:
                    extraction_enabled = _widget_query_stateful_extraction_enabled(widget_query)
                    if not extraction_enabled:
                        # Return no specs if any extraction is blocked for a widget that should have specs.
                        ignored_widget_ids[widget_query.widget.id] = True
                    metrics.incr(
                        "on_demand_metrics.widgets.can_use_stateful_extraction", sample_rate=1.0
                    )
                else:
                    # Stateful extraction cannot be used in some cases (eg. newly created or recently modified widgets).
                    # We skip cardinality checks for those cases, however, and assume extraction is allowed temporarily.
                    metrics.incr(
                        "on_demand_metrics.widgets.cannot_use_stateful_extraction", sample_rate=1.0
                    )
                    continue
            else:
                # TODO: Remove this cardinality check after above option is enabled permanently.
                if not _is_widget_query_low_cardinality(widget_query, project):
                    metrics.incr("on_demand_metrics.widget_query.high_cardinality", sample_rate=1.0)
                    ignored_widget_ids[widget_query.widget.id] = True

    metrics.incr("on_demand_metrics.widget_query_specs.pre_trim", amount=total_spec_count)
    specs = _trim_disabled_widgets(ignored_widget_ids, specs_for_widget)
    metrics.incr("on_demand_metrics.widget_query_specs.post_disabled_trim", amount=len(specs))
    max_widget_specs = get_max_widget_specs(project.organization)
    (specs, trimmed_specs) = _trim_if_above_limit(specs, max_widget_specs, project, "widgets")

    _update_state_with_spec_limit(trimmed_specs, widget_query_for_spec_hash)
    metrics.incr("on_demand_metrics.widget_query_specs", amount=len(specs))
    return specs


def _trim_disabled_widgets(
    ignored_widgets: dict[int, bool], specs_for_widget: dict[int, list[HashedMetricSpec]]
) -> list[HashedMetricSpec]:
    """Specifically remove only widget specs that share a widget (spec limit, cardinality limit)."""
    enabled_specs: list[HashedMetricSpec] = []

    for widget_id, specs in specs_for_widget.items():
        if not ignored_widgets.get(widget_id, None):
            enabled_specs.extend(specs)

    return enabled_specs


def _trim_if_above_limit(
    specs: Sequence[HashedMetricSpec],
    max_specs: int,
    project: Project,
    widget_type: str,
) -> tuple[list[HashedMetricSpec], list[HashedMetricSpec]]:
    """Trim specs per version if above max limit, returns the accepted specs and the trimmed specs in a tuple"""
    return_specs = []
    trimmed_specs = []
    specs_per_version: dict[int, dict[str, HashedMetricSpec]] = {}

    for hash, spec, spec_version in specs:
        specs_per_version.setdefault(spec_version.version, {})
        specs_per_version[spec_version.version][hash] = (hash, spec, spec_version)

    for version, _specs_for_version in specs_per_version.items():
        specs_for_version = _specs_for_version.values()
        if len(specs_for_version) > max_specs:
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("project_id", project.id)
                scope.set_context("specs", {"values": [spec[0] for spec in specs_for_version]})
                sentry_sdk.capture_exception(
                    Exception(
                        f"Spec version {version}: Too many ({len(specs_for_version)}) on demand metric {widget_type} for org {project.organization.slug}"
                    )
                )

            return_specs += list(specs_for_version)[:max_specs]
            trimmed_specs += list(specs_for_version)[max_specs:]
        else:
            return_specs += list(specs_for_version)

    return return_specs, trimmed_specs


def _update_state_with_spec_limit(
    trimmed_specs: Sequence[HashedMetricSpec],
    widget_query_for_spec_hash: dict[str, DashboardWidgetQuery],
) -> None:
    """We don't want to picked randomly last-visited widgets to exclude for specs, since we ideally want the extracted specs to be stable.
    This sets the extracted state to disabled for specs over the limit. With stateful extraction that means that we will pick a consistent set of specs
    under the limit and not have churn.
    """

    widget_queries: dict[int, set] = {}

    for spec in trimmed_specs:
        spec_hash, _, spec_version = spec
        widget_query = widget_query_for_spec_hash[spec_hash]
        if widget_query:
            widget_queries.setdefault(spec_version.version, set())
            widget_queries[spec_version.version].add(widget_query)

    for version, widget_query_set in widget_queries.items():
        for widget_query in widget_query_set:
            widget_query.dashboardwidgetqueryondemand_set.filter(spec_version=version).update(
                extraction_state=OnDemandExtractionState.DISABLED_SPEC_LIMIT
            )

    return None


@metrics.wraps("on_demand_metrics._merge_metric_specs")
def _merge_metric_specs(
    alert_specs: list[HashedMetricSpec], widget_specs: list[HashedMetricSpec]
) -> list[MetricSpec]:
    # We use a dict so that we can deduplicate metrics with the same hash.
    specs: dict[str, MetricSpec] = {}
    duplicated_specs = 0
    for query_hash, spec, _ in widget_specs + alert_specs:
        already_present = specs.get(query_hash)
        if already_present and not are_specs_equal(already_present, spec):
            logger.warning(
                "Duplicate metric spec found for hash %s with different specs.", query_hash
            )
            # Printing over two lines to prevent trimming
            logger.info("Spec 1: %s", already_present)
            logger.info("Spec 2: %s", spec)
            duplicated_specs += 1
            continue

        specs[query_hash] = spec

    if duplicated_specs > 0:
        logger.error("%s metrics are duplicated. Check breadcrumbs for details.", duplicated_specs)
        metrics.incr("on_demand_metrics.duplicate_specs", amount=duplicated_specs)

    return list(specs.values())


def _convert_snuba_query_to_metrics(
    project: Project, snuba_query: SnubaQuery, prefilling: bool
) -> Sequence[HashedMetricSpec] | None:
    """
    If the passed snuba_query is a valid query for on-demand metric extraction,
    returns a tuple of (hash, MetricSpec) for the query. Otherwise, returns None.
    """
    environment = snuba_query.environment.name if snuba_query.environment is not None else None
    return _convert_aggregate_and_query_to_metrics(
        project,
        snuba_query.dataset,
        snuba_query.aggregate,
        snuba_query.query,
        environment,
        prefilling,
    )


def convert_widget_query_to_metric(
    project: Project, widget_query: DashboardWidgetQuery, prefilling: bool
) -> list[HashedMetricSpec]:
    """
    Converts a passed metrics widget query to one or more MetricSpecs.
    Widget query can result in multiple metric specs if it selects multiple fields
    """
    metrics_specs: list[HashedMetricSpec] = []

    if not widget_query.aggregates:
        return metrics_specs

    aggregates = widget_query.aggregates
    groupbys = widget_query.columns

    for aggregate in aggregates:
        metrics_specs += _generate_metric_specs(
            aggregate, widget_query, project, prefilling, groupbys
        )

    return metrics_specs


def _generate_metric_specs(
    aggregate: str,
    widget_query: DashboardWidgetQuery,
    project: Project,
    prefilling: bool,
    groupbys: Sequence[str] | None = None,
) -> list[HashedMetricSpec]:
    metrics_specs = []
    metrics.incr("on_demand_metrics.before_widget_spec_generation")
    if results := _convert_aggregate_and_query_to_metrics(
        project,
        # there is an internal check to make sure we extract metrics only for performance dataset
        # however widgets do not have a dataset field, so we need to pass it explicitly
        Dataset.PerformanceMetrics.value,
        aggregate,
        widget_query.conditions,
        None,
        prefilling,
        groupbys=groupbys,
        spec_type=MetricSpecType.DYNAMIC_QUERY,
    ):
        for spec in results:
            _log_on_demand_metric_spec(
                project_id=project.id,
                spec_for="widget",
                spec=spec,
                id=widget_query.id,
                field=aggregate,
                query=widget_query.conditions,
                prefilling=prefilling,
            )
            metrics.incr(
                "on_demand_metrics.on_demand_spec.for_widget",
                tags={"prefilling": prefilling},
            )
            metrics_specs.append(spec)
    return metrics_specs


def get_specs_per_version(specs: Sequence[HashedMetricSpec]) -> dict[int, list[HashedMetricSpec]]:
    """This splits a list of specs into versioned specs for per-version logic"""
    specs_per_version: dict[int, list[HashedMetricSpec]] = {}
    for hash, spec, spec_version in specs:
        specs_per_version.setdefault(spec_version.version, [])
        specs_per_version[spec_version.version].append((hash, spec, spec_version))

    return specs_per_version


def _can_widget_query_use_stateful_extraction(
    widget_query: DashboardWidgetQuery, metrics_specs: Sequence[HashedMetricSpec]
) -> bool:
    """Stateful extraction for metrics is not always used, in cases where a query has been recently modified.
    Separated from enabled state check to allow us to skip cardinality checks on the vast majority of widget queries.
    """

    specs_per_version = get_specs_per_version(metrics_specs)

    stateful_extraction_version = OnDemandMetricSpecVersioning.get_default_spec_version().version
    default_version_specs = specs_per_version.get(stateful_extraction_version, [])
    spec_hashes = [hashed_spec[0] for hashed_spec in default_version_specs]

    on_demand_entries = [
        entry
        for entry in widget_query.dashboardwidgetqueryondemand_set.all()
        if entry.spec_version == stateful_extraction_version
    ]

    if len(on_demand_entries) == 0:
        # 0 on-demand entries is expected, and happens when the on-demand task hasn't caught up yet for newly created widgets or widgets recently modified to have on-demand state.
        if widget_query.date_modified > timezone.now() - timedelta(days=1):
            metrics.incr(
                "on_demand_metrics.on_demand_spec.skip_recently_modified",
                amount=len(metrics_specs),
                sample_rate=1.0,
            )
        else:
            metrics.incr(
                "on_demand_metrics.on_demand_spec.older_widget_query",
                amount=len(metrics_specs),
                sample_rate=1.0,
            )
        return False
    elif len(on_demand_entries) > 1:
        # There should only be one on demand entry.
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("widget_query", widget_query.id)
            sentry_sdk.capture_message(
                f"Wrong number of relations ({len(on_demand_entries)}) for widget_query: {widget_query.id}"
            )
        metrics.incr(
            "on_demand_metrics.on_demand_spec.failed_on_demand_relations",
            amount=len(metrics_specs),
            sample_rate=1.0,
        )
        return False

    on_demand_entry = on_demand_entries[0]
    on_demand_hashes = on_demand_entry.spec_hashes

    if on_demand_entry.date_modified < widget_query.date_modified:
        # On demand entry was updated before the widget_query got updated, meaning it's potentially out of date
        metrics.incr(
            "on_demand_metrics.on_demand_spec.out_of_date_on_demand",
            sample_rate=1.0,
        )
        return False

    if set(spec_hashes) != set(on_demand_hashes):
        # Spec hashes should match.
        metrics.incr(
            "on_demand_metrics.on_demand_spec.failed_on_demand_hashes",
            amount=len(metrics_specs),
            sample_rate=1.0,
        )

        return False

    return True


def _widget_query_stateful_extraction_enabled(widget_query: DashboardWidgetQuery) -> bool:
    """Separate from the check on whether to use stateful extracion in the first place,
    this assumes stateful extraction can be used, and returns the enabled state."""

    stateful_extraction_version = OnDemandMetricSpecVersioning.get_default_spec_version().version
    on_demand_entries = [
        entry
        for entry in widget_query.dashboardwidgetqueryondemand_set.all()
        if entry.spec_version == stateful_extraction_version
    ]

    if len(on_demand_entries) != 1:
        with sentry_sdk.push_scope() as scope:
            scope.set_extra("on_demand_entries", on_demand_entries)
            scope.set_extra("spec_version", OnDemandMetricSpecVersioning.get_spec_versions())
            sentry_sdk.capture_exception(
                Exception("Skipped extraction due to mismatched on_demand entries")
            )
        # We default to allowed extraction if something unexpected occurs otherwise customers lose data.
        return True

    on_demand_entry = on_demand_entries[0]

    return on_demand_entry.extraction_enabled()


def _get_widget_cardinality_query_ttl() -> int:
    # Add ttl + 25% jitter to query so queries aren't all made at once.
    return int(random.uniform(_WIDGET_QUERY_CARDINALITY_TTL, _WIDGET_QUERY_CARDINALITY_TTL * 1.5))


def _get_widget_cardinality_softdeadline_ttl() -> int:
    # This is a much shorter deadline than the main cardinality TTL in the case softdeadline is hit
    # We want to query again soon, but still avoid thundering herd problems.
    return int(
        random.uniform(
            _WIDGET_QUERY_CARDINALITY_SOFT_DEADLINE_TTL,
            _WIDGET_QUERY_CARDINALITY_SOFT_DEADLINE_TTL * 1.5,
        )
    )


def _is_widget_query_low_cardinality(widget_query: DashboardWidgetQuery, project: Project) -> bool:
    """
    Checks cardinality of existing widget queries before allowing the metric spec, so that
    group by clauses with high-cardinality tags are not added to the on_demand metric.

    New queries will be checked upon creation and not allowed at that time.
    """
    params: ParamsType = {
        "statsPeriod": "30m",
        "project_objects": [project],
        "organization_id": project.organization_id,  # Organization id has to be specified to not violate allocation policy.
    }
    start, end = get_date_range_from_params(params)
    params["start"] = start
    params["end"] = end

    metrics.incr("on_demand_metrics.cardinality_check")

    query_killswitch = options.get("on_demand.max_widget_cardinality.killswitch")
    if query_killswitch:
        return True

    # No columns or only errors means no high-cardinality tags.
    if not widget_query.columns or "event.type:error" in widget_query.conditions:
        metrics.incr("on_demand_metrics.cardinality_check.not_applicable")
        return True

    max_cardinality_allowed = options.get("on_demand.max_widget_cardinality.count")
    cache_key = f"check-widget-query-cardinality:{widget_query.id}"
    cardinality_allowed = cache.get(cache_key)

    if cardinality_allowed is not None:
        metrics.incr(
            "on_demand_metrics.cardinality_check.using_cache",
            tags={"low_cardinality": cardinality_allowed},
        )
        return cardinality_allowed

    unique_columns = [
        f"count_unique({column})"
        for column in widget_query.columns
        if not fields.is_function(column)
    ]

    query_builder = QueryBuilder(
        dataset=Dataset.Discover,
        params=params,
        selected_columns=unique_columns,
        config=QueryBuilderConfig(
            transform_alias_to_input_format=True,
        ),
    )

    with sentry_sdk.push_scope() as scope:
        metrics.incr("on_demand_metrics.cardinality_check.query")
        scope.set_tag("widget_query.widget_id", widget_query.id)
        scope.set_tag("widget_query.org_id", project.organization_id)
        scope.set_tag("widget_query.conditions", widget_query.conditions)

        try:
            results = query_builder.run_query(Referrer.METRIC_EXTRACTION_CARDINALITY_CHECK.value)
            processed_results = query_builder.process_results(results)
        except SoftTimeLimitExceeded as error:
            metrics.incr(
                "on_demand_metrics.cardinality_check.query.error",
                tags={"reason": "timelimit-exceeded"},
            )
            scope.set_tag("widget_soft_deadline", True)
            sentry_sdk.capture_exception(error)
            # We're setting a much shorter cache timeout here since this is essentially a permissive 'unknown' state
            cache.set(cache_key, True, timeout=_get_widget_cardinality_softdeadline_ttl())
            return True

        except Exception as error:
            metrics.incr(
                "on_demand_metrics.cardinality_check.query.error", tags={"reason": "other"}
            )
            sentry_sdk.capture_exception(error)
            cache.set(cache_key, False, timeout=_get_widget_cardinality_query_ttl())
            return False

        try:
            for index, column in enumerate(unique_columns):
                count = processed_results["data"][0][unique_columns[index]]
                if count > max_cardinality_allowed:
                    cache.set(cache_key, False, timeout=_get_widget_cardinality_query_ttl())
                    scope.set_tag("widget_query.column_name", column)
                    raise HighCardinalityWidgetException(
                        f"Cardinality exceeded for dashboard_widget_query:{widget_query.id} with count:{count} and column:{column}"
                    )
        except HighCardinalityWidgetException as error:
            metrics.incr(
                "on_demand_metrics.cardinality_check.query.success", tags={"low_cardinality": False}
            )
            sentry_sdk.capture_exception(error)
            return False

    metrics.incr(
        "on_demand_metrics.cardinality_check.query.success", tags={"low_cardinality": True}
    )
    cache.set(cache_key, True)
    return True


def _convert_aggregate_and_query_to_metrics(
    project: Project,
    dataset: str,
    aggregate: str,
    query: str,
    environment: str | None,
    prefilling: bool,
    spec_type: MetricSpecType = MetricSpecType.SIMPLE_QUERY,
    groupbys: Sequence[str] | None = None,
) -> Sequence[HashedMetricSpec] | None:
    """
    Converts an aggregate and a query to a metric spec with its hash value.

    Extra metric specs will be returned if we need to maintain various versions of it.
    This makes it easier to maintain multiple spec versions when a mistake is made.
    """

    # We can avoid injection of the environment in the query, since it's supported by standard, thus it won't change
    # the supported state of a query, since if it's standard, and we added environment it will still be standard
    # and if it's on demand, it will always be on demand irrespectively of what we add.
    if not should_use_on_demand_metrics(dataset, aggregate, query, groupbys, prefilling):
        return None

    metric_specs_and_hashes = []
    extra = {
        "dataset": dataset,
        "aggregate": aggregate,
        "query": query,
        "groupbys": groupbys,
    }
    # Create as many specs as we support
    for spec_version in OnDemandMetricSpecVersioning.get_spec_versions():
        try:
            on_demand_spec = OnDemandMetricSpec(
                field=aggregate,
                query=query,
                environment=environment,
                groupbys=groupbys,
                spec_type=spec_type,
                spec_version=spec_version,
            )
            metric_spec = on_demand_spec.to_metric_spec(project)
            # TODO: switch to validate_rule_condition
            if (condition := metric_spec.get("condition")) is not None:
                validate_sampling_condition(json.dumps(condition))
            else:
                metrics.incr(
                    "on_demand_metrics.missing_condition_spec", tags={"prefilling": prefilling}
                )

            metric_specs_and_hashes.append((on_demand_spec.query_hash, metric_spec, spec_version))
        except ValueError:
            # raised by validate_sampling_condition or metric_spec lacking "condition"
            metrics.incr("on_demand_metrics.invalid_metric_spec", tags={"prefilling": prefilling})
            logger.exception("Invalid on-demand metric spec", extra=extra)
        except Exception:
            # Since prefilling might include several non-ondemand-compatible alerts, we want to not trigger errors in the
            metrics.incr("on_demand_metrics.invalid_metric_spec.other")
            logger.exception("Failed on-demand metric spec creation.", extra=extra)

    return metric_specs_and_hashes


def _log_on_demand_metric_spec(
    project_id: int,
    spec_for: Literal["alert", "widget"],
    spec: HashedMetricSpec,
    id: int,
    field: str,
    query: str,
    prefilling: bool,
) -> None:
    spec_query_hash, spec_dict, spec_version = spec

    logger.info(
        "on_demand_metrics.on_demand_metric_spec",
        extra={
            "project_id": project_id,
            f"{spec_for}.id": id,
            f"{spec_for}.field": field,
            f"{spec_for}.query": query,
            "spec_for": spec_for,
            "spec_query_hash": spec_query_hash,
            "spec": spec_dict,
            "spec_version": spec_version,
            "prefilling": prefilling,
        },
    )


# CONDITIONAL TAGGING


class MetricConditionalTaggingRule(TypedDict):
    condition: RuleCondition
    targetMetrics: Sequence[str]
    targetTag: str
    tagValue: str


_TRANSACTION_METRICS_TO_RULE_FIELD = {
    TransactionMetric.LCP.value: "event.measurements.lcp.value",
    TransactionMetric.DURATION.value: "event.duration",
}

_SATISFACTION_TARGET_METRICS = (
    "s:transactions/user@none",
    "d:transactions/duration@millisecond",
    "d:transactions/measurements.lcp@millisecond",
)

_SATISFACTION_TARGET_TAG = "satisfaction"

_HISTOGRAM_OUTLIERS_TARGET_METRICS = {
    "duration": "d:transactions/duration@millisecond",
    "lcp": "d:transactions/measurements.lcp@millisecond",
    "fcp": "d:transactions/measurements.fcp@millisecond",
}


@dataclass
class _DefaultThreshold:
    metric: int
    threshold: int


_DEFAULT_THRESHOLD = _DefaultThreshold(
    metric=TransactionMetric[DEFAULT_THRESHOLD["metric"].upper()].value,
    threshold=int(DEFAULT_THRESHOLD["threshold"]),
)


def get_metric_conditional_tagging_rules(
    project: Project,
) -> Sequence[MetricConditionalTaggingRule]:
    rules: list[MetricConditionalTaggingRule] = []

    # transaction-specific overrides must precede the project-wide threshold in the list of rules.
    for threshold_override in project.projecttransactionthresholdoverride_set.all().order_by(
        "transaction"
    ):
        rules.extend(
            _threshold_to_rules(
                threshold_override,
                [
                    {
                        "op": "eq",
                        "name": "event.transaction",
                        "value": threshold_override.transaction,
                    }
                ],
            )
        )

    # Rules are processed top-down. The following is a fallback for when
    # there's no transaction-name-specific rule:

    try:
        threshold = ProjectTransactionThreshold.objects.get(project=project)
        rules.extend(_threshold_to_rules(threshold, []))
    except ProjectTransactionThreshold.DoesNotExist:
        rules.extend(_threshold_to_rules(_DEFAULT_THRESHOLD, []))

    rules.extend(HISTOGRAM_OUTLIER_RULES)

    return rules


def _threshold_to_rules(
    threshold: (
        ProjectTransactionThreshold | ProjectTransactionThresholdOverride | _DefaultThreshold
    ),
    extra_conditions: Sequence[RuleCondition],
) -> Sequence[MetricConditionalTaggingRule]:
    frustrated: MetricConditionalTaggingRule = {
        "condition": {
            "op": "and",
            "inner": [
                {
                    "op": "gt",
                    "name": _TRANSACTION_METRICS_TO_RULE_FIELD[threshold.metric],
                    # The frustration threshold is always four times the threshold
                    # (see https://docs.sentry.io/product/performance/metrics/#apdex)
                    "value": threshold.threshold * 4,
                },
                *extra_conditions,
            ],
        },
        "targetMetrics": _SATISFACTION_TARGET_METRICS,
        "targetTag": _SATISFACTION_TARGET_TAG,
        "tagValue": "frustrated",
    }
    tolerated: MetricConditionalTaggingRule = {
        "condition": {
            "op": "and",
            "inner": [
                {
                    "op": "gt",
                    "name": _TRANSACTION_METRICS_TO_RULE_FIELD[threshold.metric],
                    "value": threshold.threshold,
                },
                *extra_conditions,
            ],
        },
        "targetMetrics": _SATISFACTION_TARGET_METRICS,
        "targetTag": _SATISFACTION_TARGET_TAG,
        "tagValue": "tolerated",
    }
    satisfied: MetricConditionalTaggingRule = {
        "condition": {"op": "and", "inner": list(extra_conditions)},
        "targetMetrics": _SATISFACTION_TARGET_METRICS,
        "targetTag": _SATISFACTION_TARGET_TAG,
        "tagValue": "satisfied",
    }

    # Order is important here, as rules for a particular tag name are processed
    # top-down, and rules are skipped if the tag has already been defined by a
    # previous rule.
    #
    # if duration > 4000 {
    #     frustrated
    # } else if duration > 1000 {
    #     tolerated
    # } else {
    #     satisfied
    # }
    return [frustrated, tolerated, satisfied]


# These JSON results are generated by S&S using internal data-tooling. The
# roughly equivalent ClickHouse query that we used to use instead is:
#
# SELECT
#     platform,
#     transaction_op AS op,
#     uniqCombined64(project_id) AS c,
#     quantiles(0.25, 0.75)(duration) as duration,
#     quantiles(0.25, 0.75)(measurements.value[indexOf(measurements.key, 'lcp')]) as lcp,
#     quantiles(0.25, 0.75)(measurements.value[indexOf(measurements.key, 'fcp')]) as fcp
# FROM transactions_dist
# WHERE timestamp > subtractHours(now(), 48)
# GROUP BY
#     platform,
#     op
# ORDER BY c DESC
# LIMIT 50
# FORMAT CSVWithNames
_HISTOGRAM_OUTLIERS_QUERY_RESULTS = [
    {
        "platform": "javascript",
        "op": "pageload",
        "c": "55927",
        "duration": ["0", "1539", "2813", "5185", "1678818846004"],
        "lcp": [
            "-58.39991569519043",
            "730.3001880645752",
            "1364.1000000238421",
            "2533.2000255584717",
            "7160348981.6997051",
        ],
        "fcp": [
            "-30.0",
            "578.29999923706055",
            "1051.0001182556152",
            "1908.10000000149",
            "4295032969.0001011",
        ],
    },
    {
        "platform": "javascript",
        "op": "navigation",
        "c": "46130",
        "duration": ["0", "372", "964", "1287", "1678819998036"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "python",
        "op": "http.server",
        "c": "20286",
        "duration": ["0", "3", "23", "98", "7169297964"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "node",
        "op": "http.server",
        "c": "16548",
        "duration": ["0", "2", "20", "128", "40043925665"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "php",
        "op": "http.server",
        "c": "11844",
        "duration": ["0", "35", "90", "249", "194551915"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "javascript",
        "op": "ui.load",
        "c": "5586",
        "duration": ["0", "1419", "3849", "50909", "1678715114066"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "python",
        "op": "celery.task",
        "c": "2936",
        "duration": ["0", "32", "94", "403", "462304451"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "ruby",
        "op": "rails.request",
        "c": "2719",
        "duration": ["0", "7", "27", "107", "411239453"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "python",
        "op": "queue.task.celery",
        "c": "2122",
        "duration": ["0", "29", "122", "681", "281861579"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "node",
        "op": "function.nextjs",
        "c": "2048",
        "duration": ["0", "1", "26", "127", "1047980"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "cocoa",
        "op": "ui.load",
        "c": "2025",
        "duration": ["0", "135", "554", "698", "1678189573840"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "csharp",
        "op": "http.server",
        "c": "1951",
        "duration": ["0", "1", "15", "82", "683064520"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "ruby",
        "op": "http.server",
        "c": "1944",
        "duration": ["0", "7", "20", "92", "230606309"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "java",
        "op": "ui.load",
        "c": "1867",
        "duration": ["0", "145", "291", "831", "1678830256706"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "java",
        "op": "http.server",
        "c": "1772",
        "duration": ["0", "2", "9", "63", "335196060"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "node",
        "op": "awslambda.handler",
        "c": "1522",
        "duration": ["0", "19", "103", "451", "2274015"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "python",
        "op": "serverless.function",
        "c": "1046",
        "duration": ["0", "29", "52", "120", "32730840"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "node",
        "op": "function.aws.lambda",
        "c": "915",
        "duration": ["0", "61", "206", "454", "8143646"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "javascript",
        "op": "default",
        "c": "850",
        "duration": ["0", "0", "237", "804", "1678679274843"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "python",
        "op": "function.aws",
        "c": "821",
        "duration": ["0", "0", "75", "366", "899160"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "ruby",
        "op": "active_job",
        "c": "729",
        "duration": ["0", "31", "153", "288", "14992111"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "other",
        "op": "navigation",
        "c": "689",
        "duration": ["0", "1102", "2629", "3003", "448059236223"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "ruby",
        "op": "queue.active_job",
        "c": "629",
        "duration": ["0", "25", "112", "1216", "202727763"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "ruby",
        "op": "sidekiq",
        "c": "569",
        "duration": ["0", "14", "69", "246", "34998169"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "other",
        "op": "pageload",
        "c": "551",
        "duration": ["988", "3000", "3000", "3000", "3700"],
        "lcp": [
            "4589.8220456729478",
            "4589.8220456729478",
            "4589.8220456729478",
            "4589.8220456729478",
            "4589.8220456729478",
        ],
        "fcp": [
            "2057.7001571655273",
            "3384.3555060724457",
            "3384.3555060724457",
            "3384.3555060724457",
            "3384.3555060724457",
        ],
    },
    {
        "platform": "php",
        "op": "console.command",
        "c": "462",
        "duration": ["0", "61", "150", "417", "3607425204"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "other",
        "op": "middleware.nextjs",
        "c": "447",
        "duration": ["0", "0", "0", "0", "185123"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "ruby",
        "op": "queue.sidekiq",
        "c": "447",
        "duration": ["0", "18", "145", "579", "24701323"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "node",
        "op": "transaction",
        "c": "446",
        "duration": ["0", "5", "20", "87", "602756293"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "cocoa",
        "op": "ui.action",
        "c": "444",
        "duration": ["0", "244", "1057", "2783", "498994"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "node",
        "op": "default",
        "c": "418",
        "duration": ["0", "2", "69", "423", "24534033"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "cocoa",
        "op": "ui.action.click",
        "c": "400",
        "duration": ["0", "223", "1127", "3797", "84802486"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "python",
        "op": "asgi.server",
        "c": "346",
        "duration": ["0", "158", "298", "1291", "33673793505"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "go",
        "op": "http.server",
        "c": "302",
        "duration": ["0", "0", "0", "4", "167496305"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "php",
        "op": "sentry.test",
        "c": "280",
        "duration": ["0", "0", "0", "1", "223"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "ruby",
        "op": "websocket.server",
        "c": "255",
        "duration": ["0", "0", "1", "4", "1065382"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "java",
        "op": "ui.action.click",
        "c": "207",
        "duration": ["0", "343", "1271", "3560", "228385283"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "other",
        "op": "http.server",
        "c": "200",
        "duration": ["0", "0", "7", "57", "7954687"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "node",
        "op": "test",
        "c": "188",
        "duration": ["0", "12", "409", "1080", "263783678"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "node",
        "op": "gql",
        "c": "181",
        "duration": ["0", "16", "39", "135", "1503274"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "python",
        "op": "default",
        "c": "181",
        "duration": ["0", "5", "11", "67", "108818494"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "ruby",
        "op": "rails.action_cable",
        "c": "177",
        "duration": ["0", "0", "0", "5", "291392"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "php",
        "op": "queue.process",
        "c": "167",
        "duration": ["0", "26", "68", "232", "1641192"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "python",
        "op": "websocket.server",
        "c": "160",
        "duration": ["0", "1", "2", "6226", "518009460"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "python",
        "op": "rq.task",
        "c": "151",
        "duration": ["2", "175", "388", "490", "73547039"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "python",
        "op": "task",
        "c": "147",
        "duration": ["0", "9", "54", "336", "12559622"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "java",
        "op": "ui.action.swipe",
        "c": "139",
        "duration": ["0", "966", "2343", "5429", "56370777"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "python",
        "op": "queue.task.rq",
        "c": "136",
        "duration": ["2", "113", "277", "913", "14400609"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "java",
        "op": "navigation",
        "c": "125",
        "duration": ["0", "327", "1091", "2657", "123162256"],
        "lcp": [],
        "fcp": [],
    },
    {
        "platform": "java",
        "op": "ui.action.scroll",
        "c": "107",
        "duration": ["1", "400", "951", "2158", "45034933"],
        "lcp": [],
        "fcp": [],
    },
]


def _parse_percentiles(value: tuple[()] | tuple[str, str, str, str, str]) -> tuple[float, float]:
    if not value:
        return 0, 0
    _min, p25, _p50, p75, _max = map(float, value)
    return p25, p75


def _produce_histogram_outliers(query_results: Any) -> Sequence[MetricConditionalTaggingRule]:
    rules: list[MetricConditionalTaggingRule] = []
    for row in query_results:
        platform = row["platform"]
        op = row["op"]
        duration = row["duration"]
        lcp = row["lcp"]
        fcp = row["fcp"]
        duration_p25, duration_p75 = _parse_percentiles(duration)
        lcp_p25, lcp_p75 = _parse_percentiles(lcp)
        fcp_p25, fcp_p75 = _parse_percentiles(fcp)

        for metric, p25, p75 in (
            ("duration", duration_p25, duration_p75),
            ("lcp", lcp_p25, lcp_p75),
            ("fcp", fcp_p25, fcp_p75),
        ):
            if p25 == p75 == 0:
                # default values from clickhouse if no data is present
                continue

            rules.append(
                {
                    "condition": {
                        "op": "and",
                        "inner": [
                            {"op": "eq", "name": "event.contexts.trace.op", "value": op},
                            {"op": "eq", "name": "event.platform", "value": platform},
                            # This is in line with https://github.com/getsentry/sentry/blob/63308b3f2256fe2f24da43a951154d0ef2218d19/src/sentry/snuba/discover.py#L1728-L1729=
                            # See also https://en.wikipedia.org/wiki/Outlier#Tukey's_fences
                            {
                                "op": "gte",
                                "name": "event.duration",
                                "value": p75 + 3 * abs(p75 - p25),
                            },
                        ],
                    },
                    "targetMetrics": [_HISTOGRAM_OUTLIERS_TARGET_METRICS[metric]],
                    "targetTag": "histogram_outlier",
                    "tagValue": "outlier",
                }
            )

    rules.append(
        {
            "condition": {
                "op": "and",
                "inner": [
                    {"op": "gte", "name": "event.duration", "value": 0},
                ],
            },
            "targetMetrics": list(_HISTOGRAM_OUTLIERS_TARGET_METRICS.values()),
            "targetTag": "histogram_outlier",
            "tagValue": "inlier",
        }
    )

    rules.append(
        {
            "condition": {"op": "and", "inner": []},
            "targetMetrics": list(_HISTOGRAM_OUTLIERS_TARGET_METRICS.values()),
            "targetTag": "histogram_outlier",
            "tagValue": "outlier",
        }
    )

    return rules


def get_current_widget_specs(organization: Organization) -> set[str]:
    current_version = OnDemandMetricSpecVersioning.get_query_spec_version(organization.id)
    widget_specs = DashboardWidgetQueryOnDemand.objects.filter(
        spec_version=current_version.version,
        dashboard_widget_query__widget__dashboard__organization=organization,
        extraction_state__startswith=ON_DEMAND_ENABLED_KEY,
    ).values_list("spec_hashes", flat=True)
    current_widget_specs: set[str] = set()
    for spec_list in widget_specs:
        current_widget_specs = current_widget_specs.union(spec_list)
    return current_widget_specs


def widget_exceeds_max_specs(
    new_specs: Sequence[tuple[str, MetricSpec, SpecVersion]],
    current_widget_specs: set[str],
    organization: Organization,
) -> bool:
    current_version = OnDemandMetricSpecVersioning.get_query_spec_version(organization.id)
    new_widget_specs = {
        widget_hash for widget_hash, _, spec_version in new_specs if spec_version == current_version
    }

    max_widget_specs = get_max_widget_specs(organization)
    return len(current_widget_specs.union(new_widget_specs)) > max_widget_specs


HISTOGRAM_OUTLIER_RULES = _produce_histogram_outliers(_HISTOGRAM_OUTLIERS_QUERY_RESULTS)
