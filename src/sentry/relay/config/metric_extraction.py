import logging
from collections.abc import Sequence

from sentry_relay.processing import validate_sampling_condition

from sentry import features, options
from sentry.incidents.models.alert_rule import AlertRule, AlertRuleStatus
from sentry.models.dashboard_widget import (
    ON_DEMAND_ENABLED_KEY,
    DashboardWidgetQuery,
    DashboardWidgetQueryOnDemand,
)
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics.extraction import (
    MetricSpec,
    MetricSpecType,
    OnDemandMetricSpec,
    OnDemandMetricSpecError,
    OnDemandMetricSpecVersioning,
    SpecVersion,
    should_use_on_demand_metrics,
)
from sentry.snuba.models import SnubaQuery
from sentry.utils import json, metrics
from sentry.utils.tracing import set_span_data, start_span

logger = logging.getLogger(__name__)

# GENERIC METRIC EXTRACTION

HashedMetricSpec = tuple[str, MetricSpec, SpecVersion]


def get_max_widget_specs(organization: Organization) -> int:
    if organization.id in options.get("on_demand.extended_widget_spec_orgs") and options.get(
        "on_demand.extended_max_widget_specs"
    ):
        return options.get("on_demand.extended_max_widget_specs")

    max_widget_specs = options.get("on_demand.max_widget_specs")
    return max_widget_specs


def get_max_alert_specs(organization: Organization) -> int:
    if organization.id in options.get("on_demand.extended_alert_spec_orgs") and (
        extended_max_specs := options.get("on_demand.extended_max_alert_specs")
    ):
        return extended_max_specs

    max_alert_specs = options.get("on_demand.max_alert_specs")
    return max_alert_specs


def on_demand_metrics_feature_flags(organization: Organization) -> set[str]:
    feature_names = [
        "organizations:on-demand-metrics-extraction",
        "organizations:on-demand-metrics-extraction-widgets",  # Controls extraction for widgets
        "organizations:on-demand-metrics-prefill",
    ]

    enabled_features = set()
    for feature in feature_names:
        if features.has(feature, organization=organization):
            enabled_features.add(feature)

    return enabled_features


def get_all_alert_metric_specs(
    project: Project,
    enabled_features: set[str],
    prefilling: bool,
    prefilling_for_deprecation: bool,
) -> list[HashedMetricSpec]:
    if not (
        "organizations:on-demand-metrics-extraction" in enabled_features
        or prefilling
        or prefilling_for_deprecation
    ):
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

            if results := _convert_snuba_query_to_metrics(
                project,
                alert_snuba_query,
                prefilling,
                prefilling_for_deprecation=prefilling_for_deprecation,
            ):
                for spec in results:
                    metrics.incr(
                        "on_demand_metrics.on_demand_spec.for_alert",
                        tags={"prefilling": prefilling},
                    )
                    specs.append(spec)
    return specs


def get_default_version_alert_metric_specs(
    project: Project,
    enabled_features: set[str],
    prefilling: bool,
    prefilling_for_deprecation: bool,
) -> list[HashedMetricSpec]:
    specs = get_all_alert_metric_specs(
        project, enabled_features, prefilling, prefilling_for_deprecation=prefilling_for_deprecation
    )
    specs_per_version = get_specs_per_version(specs)
    default_extraction_version = OnDemandMetricSpecVersioning.get_default_spec_version().version
    return specs_per_version.get(default_extraction_version, [])


def _convert_snuba_query_to_metrics(
    project: Project,
    snuba_query: SnubaQuery,
    prefilling: bool,
    prefilling_for_deprecation: bool,
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
        prefilling_for_deprecation=prefilling_for_deprecation,
    )


def convert_widget_query_to_metric(
    project: Project,
    widget_query: DashboardWidgetQuery,
    prefilling: bool,
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
            aggregate,
            widget_query,
            project,
            prefilling,
            prefilling_for_deprecation=False,
            groupbys=groupbys,
        )

    return metrics_specs


def _generate_metric_specs(
    aggregate: str,
    widget_query: DashboardWidgetQuery,
    project: Project,
    prefilling: bool,
    prefilling_for_deprecation: bool,
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
        prefilling_for_deprecation,
        groupbys=groupbys,
        spec_type=MetricSpecType.DYNAMIC_QUERY,
    ):
        for spec in results:
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


def _convert_aggregate_and_query_to_metrics(
    project: Project,
    dataset: str,
    aggregate: str,
    query: str,
    environment: str | None,
    prefilling: bool,
    prefilling_for_deprecation: bool,
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
    if not should_use_on_demand_metrics(
        dataset,
        aggregate,
        query,
        groupbys,
        prefilling,
        prefilling_for_deprecation=prefilling_for_deprecation,
    ):
        return None

    metric_specs_and_hashes = []
    extra = {
        "dataset": dataset,
        "aggregate": aggregate,
        "query": query,
        "groupbys": groupbys,
    }

    with start_span(
        op="converting_aggregate_and_query", name="converting_aggregate_and_query"
    ) as span:
        set_span_data(span, "widget_query_args", {"query": query, "aggregate": aggregate})
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

                metric_specs_and_hashes.append(
                    (on_demand_spec.query_hash, metric_spec, spec_version)
                )
            except ValueError:
                # raised by validate_sampling_condition or metric_spec lacking "condition"
                metrics.incr(
                    "on_demand_metrics.invalid_metric_spec", tags={"prefilling": prefilling}
                )
                logger.exception("Invalid on-demand metric spec", extra=extra)

            except OnDemandMetricSpecError:
                metrics.incr("on_demand_metrics.invalid_metric_spec.other")
                logger.warning(
                    "Failed on-demand metric spec creation due to specification error.", extra=extra
                )

            except Exception:
                # Since prefilling might include several non-ondemand-compatible alerts, we want to not trigger errors in the
                metrics.incr("on_demand_metrics.invalid_metric_spec.other")
                logger.exception("Failed on-demand metric spec creation.", extra=extra)

    return metric_specs_and_hashes


def get_current_widget_specs(organization: Organization) -> set[str]:
    current_version = OnDemandMetricSpecVersioning.get_query_spec_version(organization.id)
    widget_specs = DashboardWidgetQueryOnDemand.objects.filter(
        spec_version=current_version.version,
        dashboard_widget_query__widget__dashboard__organization=organization,
        extraction_state__startswith=ON_DEMAND_ENABLED_KEY,
    ).values_list("spec_hashes", flat=True)
    current_widget_specs: set[str] = set()
    for spec_list in widget_specs:
        if spec_list is not None:
            current_widget_specs.update(spec_list)
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
