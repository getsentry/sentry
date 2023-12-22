import logging
import random
from dataclasses import dataclass
from typing import Any, Dict, List, Literal, Optional, Sequence, Set, Tuple, TypedDict, Union

import sentry_sdk
from celery.exceptions import SoftTimeLimitExceeded
from sentry_relay.processing import validate_sampling_condition

from sentry import features, options
from sentry.api.endpoints.project_transaction_threshold import DEFAULT_THRESHOLD
from sentry.api.utils import get_date_range_from_params
from sentry.incidents.models import AlertRule, AlertRuleStatus
from sentry.models.dashboard_widget import DashboardWidgetQuery, DashboardWidgetTypes
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.transaction_threshold import (
    ProjectTransactionThreshold,
    ProjectTransactionThresholdOverride,
    TransactionMetric,
)
from sentry.search.events import fields
from sentry.search.events.builder import QueryBuilder
from sentry.search.events.types import QueryBuilderConfig
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics.extraction import (
    MetricSpec,
    MetricSpecType,
    OnDemandMetricSpec,
    RuleCondition,
    should_use_on_demand_metrics,
)
from sentry.snuba.models import SnubaQuery
from sentry.snuba.referrer import Referrer
from sentry.utils import json, metrics
from sentry.utils.cache import cache

logger = logging.getLogger(__name__)

# GENERIC METRIC EXTRACTION

# Version of the metric extraction config.
_METRIC_EXTRACTION_VERSION = 2

# Maximum number of custom metrics that can be extracted for alerts and widgets with
# advanced filter expressions.
_MAX_ON_DEMAND_ALERTS = 50
_MAX_ON_DEMAND_WIDGETS = 100

# TTL for cardinality check
_WIDGET_QUERY_CARDINALITY_TTL = 3600 * 24  # 24h
_WIDGET_QUERY_CARDINALITY_SOFT_DEADLINE_TTL = 3600 * 0.5  # 30m

HashedMetricSpec = Tuple[str, MetricSpec]


class HighCardinalityWidgetException(Exception):
    pass


class MetricExtractionConfig(TypedDict):
    """Configuration for generic extraction of metrics from all data categories."""

    version: int
    metrics: List[MetricSpec]


@metrics.wraps("on_demand_metrics.get_metric_extraction_config")
def get_metric_extraction_config(project: Project) -> Optional[MetricExtractionConfig]:
    """
    Returns generic metric extraction config for the given project.

    This requires respective feature flags to be enabled. At the moment, metrics
    for the following models are extracted:
     - Performance alert rules with advanced filter expressions.
     - On-demand metrics widgets.
    """
    # For efficiency purposes, we fetch the flags in batch and propagate them downstream.
    enabled_features = on_demand_metrics_feature_flags(project.organization)

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


def on_demand_metrics_feature_flags(organization: Organization) -> Set[str]:
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
    project: Project, enabled_features: Set[str], prefilling: bool
) -> List[HashedMetricSpec]:
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

            if result := _convert_snuba_query_to_metric(
                project, alert_snuba_query, prefilling, use_updated_env_logic=True
            ):
                _log_on_demand_metric_spec(
                    project_id=project.id,
                    spec_for="alert",
                    spec=result,
                    id=alert.id,
                    field=alert_snuba_query.aggregate,
                    query=alert_snuba_query.query,
                    prefilling=prefilling,
                )
                metrics.incr(
                    "on_demand_metrics.on_demand_spec.for_alert",
                    tags={"prefilling": prefilling},
                )
                specs.append(result)

            # In case the query has an environment, we want to extract with the old environment logic, since we found
            # a bug in the old logic and this requires us to extract the same metric in parallel but with a different
            # query hash.
            if alert_snuba_query.environment_id is not None:
                if result := _convert_snuba_query_to_metric(
                    project, alert_snuba_query, prefilling, use_updated_env_logic=False
                ):
                    _log_on_demand_metric_spec(
                        project_id=project.id,
                        spec_for="alert",
                        spec=result,
                        id=alert.id,
                        field=alert_snuba_query.aggregate,
                        query=alert_snuba_query.query,
                        prefilling=prefilling,
                    )
                    metrics.incr(
                        "on_demand_metrics.on_demand_spec.for_alert",
                        tags={"prefilling": prefilling},
                    )
                    specs.append(result)

    max_alert_specs = options.get("on_demand.max_alert_specs") or _MAX_ON_DEMAND_ALERTS
    if len(specs) > max_alert_specs:
        logger.error(
            "Too many (%s) on demand metric alerts for project %s", len(specs), project.slug
        )
        specs = specs[:max_alert_specs]

    return specs


@metrics.wraps("on_demand_metrics._get_widget_metric_specs")
def _get_widget_metric_specs(
    project: Project, enabled_features: Set[str], prefilling: bool
) -> List[HashedMetricSpec]:
    if "organizations:on-demand-metrics-extraction-widgets" not in enabled_features:
        metrics.incr("on_demand_metrics.get_widget_metric_specs.extraction_feature_disabled")
        return []

    metrics.incr(
        "on_demand_metrics.get_widgets",
        tags={"prefilling": prefilling},
    )

    # fetch all queries of all on demand metrics widgets of this organization
    widget_queries = DashboardWidgetQuery.objects.filter(
        widget__dashboard__organization=project.organization,
        widget__widget_type=DashboardWidgetTypes.DISCOVER,
    ).prefetch_related("dashboardwidgetqueryondemand_set")

    metrics.incr(
        "on_demand_metrics.widgets_to_process", amount=len(widget_queries), sample_rate=1.0
    )

    specs: List[HashedMetricSpec] = []
    with metrics.timer("on_demand_metrics.widget_spec_convert"):
        for widget in widget_queries:
            widget_specs = convert_widget_query_to_metric(project, widget, prefilling)
            specs.extend(widget_specs)

            can_widget_use_stateful_extraction = _can_widget_use_stateful_extraction(
                widget, widget_specs
            )
            if options.get("on_demand_metrics.widgets.use_stateful_extraction"):
                if not can_widget_use_stateful_extraction:
                    return []

            # TODO: Remove this cardinality check after above option is enabled permanently.
            if widget_specs and not _is_widget_query_low_cardinality(widget, project):
                # High cardinality widgets don't have metrics specs created
                return []

    max_widget_specs = options.get("on_demand.max_widget_specs") or _MAX_ON_DEMAND_WIDGETS
    if len(specs) > max_widget_specs:
        logger.error(
            "Too many (%s) on demand metric widgets for project %s", len(specs), project.slug
        )
        specs = specs[:max_widget_specs]

    return specs


@metrics.wraps("on_demand_metrics._merge_metric_specs")
def _merge_metric_specs(
    alert_specs: List[HashedMetricSpec], widget_specs: List[HashedMetricSpec]
) -> List[MetricSpec]:
    # We use a dict so that we can deduplicate metrics with the same hash.
    metrics: Dict[str, MetricSpec] = {}
    for query_hash, spec in alert_specs + widget_specs:
        already_present = metrics.get(query_hash)
        if already_present and already_present != spec:
            logger.error(
                "Duplicate metric spec found for hash %s with different specs: %s != %s",
                query_hash,
                already_present,
                spec,
            )
            continue

        metrics[query_hash] = spec

    return [metric for metric in metrics.values()]


def _convert_snuba_query_to_metric(
    project: Project, snuba_query: SnubaQuery, prefilling: bool, use_updated_env_logic: bool
) -> Optional[HashedMetricSpec]:
    """
    If the passed snuba_query is a valid query for on-demand metric extraction,
    returns a tuple of (hash, MetricSpec) for the query. Otherwise, returns None.
    """
    environment = snuba_query.environment.name if snuba_query.environment is not None else None
    return _convert_aggregate_and_query_to_metric(
        project,
        snuba_query.dataset,
        snuba_query.aggregate,
        snuba_query.query,
        environment,
        prefilling,
        use_updated_env_logic=use_updated_env_logic,
    )


def convert_widget_query_to_metric(
    project: Project, widget_query: DashboardWidgetQuery, prefilling: bool
) -> Sequence[HashedMetricSpec]:
    """
    Converts a passed metrics widget query to one or more MetricSpecs.
    Widget query can result in multiple metric specs if it selects multiple fields
    """
    metrics_specs: List[HashedMetricSpec] = []

    if not widget_query.aggregates:
        return metrics_specs

    if "event.type:error" in widget_query.conditions:
        # Error widgets don't get on-demand extracted.
        return []

    for aggregate in widget_query.aggregates:
        metrics.incr(
            "on_demand_metrics.before_widget_spec_generation",
            tags={"prefilling": prefilling},
        )
        if result := _convert_aggregate_and_query_to_metric(
            project,
            # there is an internal check to make sure we extract metrics only for performance dataset
            # however widgets do not have a dataset field, so we need to pass it explicitly
            Dataset.PerformanceMetrics.value,
            aggregate,
            widget_query.conditions,
            None,
            prefilling,
            groupbys=widget_query.columns,
            spec_type=MetricSpecType.DYNAMIC_QUERY,
        ):
            _log_on_demand_metric_spec(
                project_id=project.id,
                spec_for="widget",
                spec=result,
                id=widget_query.id,
                field=aggregate,
                query=widget_query.conditions,
                prefilling=prefilling,
            )
            metrics.incr(
                "on_demand_metrics.on_demand_spec.for_widget",
                tags={"prefilling": prefilling},
            )
            metrics_specs.append(result)

    return metrics_specs


def _can_widget_use_stateful_extraction(
    widget_query: DashboardWidgetQuery, metrics_specs: Sequence[HashedMetricSpec]
) -> bool:
    if not metrics_specs:
        return False
    spec_hashes = [hashed_spec[0] for hashed_spec in metrics_specs]
    on_demand_entries = widget_query.dashboardwidgetqueryondemand_set.all()

    if len(on_demand_entries) != 1:
        # There should only be one on demand entry
        sentry_sdk.capture_message(
            f"Wrong number of relations ({len(on_demand_entries)}) for widget_query: {widget_query.id}"
        )
        metrics.incr("on_demand_metrics.on_demand_spec.failed_on_demand_relations", sample_rate=1.0)
        return False

    on_demand_entry = on_demand_entries[0]
    on_demand_hashes = on_demand_entry.spec_hashes

    if set(spec_hashes) != set(on_demand_hashes):
        # Spec hashes should match. TODO:This can be removed after the existing cardinality check in this task is removed.
        with sentry_sdk.push_scope() as scope:
            scope.set_extra("spec_hashes", spec_hashes)
            scope.set_extra("on_demand_hashes", on_demand_hashes)
            sentry_sdk.capture_message(f"Hashes don't match for widget_query: {widget_query.id}")
        metrics.incr("on_demand_metrics.on_demand_spec.failed_on_demand_hashes", sample_rate=1.0)
        return False

    return True


def _get_widget_cardinality_query_ttl():
    # Add ttl + 25% jitter to query so queries aren't all made at once.
    return int(random.uniform(_WIDGET_QUERY_CARDINALITY_TTL, _WIDGET_QUERY_CARDINALITY_TTL * 1.5))


def _get_widget_cardinality_softdeadline_ttl():
    # This is a much shorter deadline than the main cardinality TTL in the case softdeadline is hit
    # We want to query again soon, but still avoid thundering herd problems.
    return int(
        random.uniform(
            _WIDGET_QUERY_CARDINALITY_SOFT_DEADLINE_TTL,
            _WIDGET_QUERY_CARDINALITY_SOFT_DEADLINE_TTL * 1.5,
        )
    )


def _is_widget_query_low_cardinality(widget_query: DashboardWidgetQuery, project: Project):
    """
    Checks cardinality of existing widget queries before allowing the metric spec, so that
    group by clauses with high-cardinality tags are not added to the on_demand metric.

    New queries will be checked upon creation and not allowed at that time.
    """
    params: Dict[str, Any] = {
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
        return False

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


def _convert_aggregate_and_query_to_metric(
    project: Project,
    dataset: str,
    aggregate: str,
    query: str,
    environment: Optional[str],
    prefilling: bool,
    spec_type: MetricSpecType = MetricSpecType.SIMPLE_QUERY,
    groupbys: Optional[Sequence[str]] = None,
    use_updated_env_logic: bool = False,
) -> Optional[HashedMetricSpec]:
    """
    Converts an aggregate and a query to a metric spec with its hash value.
    """
    try:
        # We can avoid injection of the environment in the query, since it's supported by standard, thus it won't change
        # the supported state of a query, since if it's standard, and we added environment it will still be standard
        # and if it's on demand, it will always be on demand irrespectively of what we add.
        if not should_use_on_demand_metrics(dataset, aggregate, query, groupbys, prefilling):
            return None

        on_demand_spec = OnDemandMetricSpec(
            field=aggregate,
            query=query,
            environment=environment,
            groupbys=groupbys,
            spec_type=spec_type,
            use_updated_env_logic=use_updated_env_logic,
        )

        metric_spec = on_demand_spec.to_metric_spec(project)
        # TODO: switch to validate_rule_condition
        if (condition := metric_spec.get("condition")) is not None:
            validate_sampling_condition(json.dumps(condition))
        else:
            metrics.incr(
                "on_demand_metrics.missing_condition_spec",
                tags={"prefilling": prefilling},
            )

        return on_demand_spec.query_hash, metric_spec
    except ValueError:
        # raised by validate_sampling_condition or metric_spec lacking "condition"
        metrics.incr(
            "on_demand_metrics.invalid_metric_spec",
            tags={"prefilling": prefilling},
        )
        logger.exception(
            "Invalid on-demand metric spec",
            extra={
                "dataset": dataset,
                "aggregate": aggregate,
                "query": query,
                "groupbys": groupbys,
            },
        )

        return None
    except Exception as e:
        # Since prefilling might include several non-ondemand-compatible alerts, we want to not trigger errors in the
        # Sentry console.
        if not prefilling:
            logger.exception(str(e))

        return None


def _log_on_demand_metric_spec(
    project_id: int,
    spec_for: Literal["alert", "widget"],
    spec: HashedMetricSpec,
    id: int,
    field: str,
    query: str,
    prefilling: bool,
) -> None:
    spec_query_hash, spec_dict = spec

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
    rules: List[MetricConditionalTaggingRule] = []

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
    threshold: Union[
        ProjectTransactionThreshold, ProjectTransactionThresholdOverride, _DefaultThreshold
    ],
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


def _parse_percentiles(
    value: Union[Tuple[()], Tuple[str, str, str, str, str]]
) -> Tuple[float, float]:
    if not value:
        return 0, 0
    _min, p25, _p50, p75, _max = map(float, value)
    return p25, p75


def _produce_histogram_outliers(query_results: Any) -> Sequence[MetricConditionalTaggingRule]:
    rules: List[MetricConditionalTaggingRule] = []
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


HISTOGRAM_OUTLIER_RULES = _produce_histogram_outliers(_HISTOGRAM_OUTLIERS_QUERY_RESULTS)
