from collections import defaultdict
from collections.abc import Sequence
from typing import cast

from sentry.constants import (
    METRICS_ACTIVATE_LAST_FOR_GAUGES_DEFAULT,
    METRICS_ACTIVATE_PERCENTILES_DEFAULT,
)
from sentry.models.options import OrganizationOption
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.sentry_metrics.configuration import METRIC_TYPE_TO_AGGREGATE
from sentry.sentry_metrics.extraction_rules import MetricsExtractionRule
from sentry.sentry_metrics.models import SpanAttributeExtractionRuleConfig
from sentry.sentry_metrics.querying.metadata.utils import (
    METRICS_API_HIDDEN_OPERATIONS,
    OperationsConfiguration,
)
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.dataset import EntityKey
from sentry.snuba.metrics import parse_mri
from sentry.snuba.metrics.datasource import get_metrics_blocking_state_of_projects
from sentry.snuba.metrics.naming_layer.mri import ParsedMRI, get_available_operations
from sentry.snuba.metrics.utils import (
    BlockedMetric,
    MetricMeta,
    MetricOperationType,
    MetricType,
    MetricUnit,
    SpanBasedMeta,
    entity_key_to_metric_type,
)
from sentry.snuba.metrics_layer.query import fetch_metric_mris


def get_metrics_meta(
    organization: Organization,
    projects: Sequence[Project],
    use_case_ids: Sequence[UseCaseID],
) -> Sequence[MetricMeta]:
    if not projects:
        return []

    metrics_metas = []
    operations_config = generate_operations_config(organization)

    for use_case_id in use_case_ids:
        stored_metrics = get_available_mris(organization, projects, use_case_id)
        if use_case_id == UseCaseID.CUSTOM:
            metrics_blocking_state = get_metrics_blocking_state_of_projects(projects)
        else:
            metrics_blocking_state = {}
        for metric_mri, project_ids in stored_metrics.items():
            parsed_mri = parse_mri(metric_mri)

            if parsed_mri is None:
                continue

            blocking_status = []
            if (metric_blocking := metrics_blocking_state.get(metric_mri)) is not None:
                blocking_status = [
                    BlockedMetric(
                        isBlocked=is_blocked, blockedTags=blocked_tags, projectId=project_id
                    )
                    for is_blocked, blocked_tags, project_id in metric_blocking
                ]
                # We delete the metric so that in the next steps we can just merge the remaining blocked metrics that are
                # not stored.
                del metrics_blocking_state[metric_mri]

            metrics_metas.append(
                _build_metric_meta(parsed_mri, project_ids, blocking_status, operations_config)
            )

        for metric_mri, metric_blocking in metrics_blocking_state.items():
            parsed_mri = parse_mri(metric_mri)
            if parsed_mri is None:
                continue

            metrics_metas.append(
                _build_metric_meta(
                    parsed_mri,
                    [],
                    [
                        BlockedMetric(
                            isBlocked=is_blocked, blockedTags=blocked_tags, projectId=project_id
                        )
                        for is_blocked, blocked_tags, project_id in metric_blocking
                    ],
                    operations_config,
                )
            )

    span_attribute_extraction_rule_configs = SpanAttributeExtractionRuleConfig.objects.filter(
        project__in=projects
    )
    for config in span_attribute_extraction_rule_configs:
        metric_types = MetricsExtractionRule.infer_types(config.aggregates)
        for metric_type in metric_types:
            for condition in config.conditions.all():
                internal_mri = f"{metric_type}:custom/span_attribute_{condition.id}@{config.unit}"
                virtual_mri = f"v:custom/{config.span_attribute}|{config.project.id}@{config.unit}"
                custom_meta = {
                    "spanBasedMeta": SpanBasedMeta(
                        associatedSpanAttribute=config.span_attribute,
                        associatedProjectId=config.project.id,
                        virtualMRI=virtual_mri,
                    )
                }

                metric_type_map = {
                    "d": entity_key_to_metric_type(EntityKey.GenericMetricsDistributions),
                    "s": entity_key_to_metric_type(EntityKey.GenericMetricsSets),
                    "c": entity_key_to_metric_type(EntityKey.GenericMetricsCounters),
                    "g": entity_key_to_metric_type(EntityKey.GenericMetricsGauges),
                }

                new_meta = MetricMeta(
                    name=config.span_attribute,
                    type=metric_type_map[metric_type],
                    operations=METRIC_TYPE_TO_AGGREGATE[metric_type],
                    unit=config.unit,
                    mri=internal_mri,
                    projectIds=[config.project_id],
                    blockingStatus=None,
                    customMeta=custom_meta,
                )
                metrics_metas.append(new_meta)

    return metrics_metas


def generate_operations_config(organization: Organization) -> OperationsConfiguration:
    operations_config = OperationsConfiguration()
    configuration_options: dict[str, bool] = {
        "sentry:metrics_activate_percentiles": METRICS_ACTIVATE_PERCENTILES_DEFAULT,
        "sentry:metrics_activate_last_for_gauges": METRICS_ACTIVATE_LAST_FOR_GAUGES_DEFAULT,
    }

    for option_key, default_value in configuration_options.items():
        if not OrganizationOption.objects.get_value(
            organization=organization, key=option_key, default=default_value
        ):
            operations_config.hide_operations(METRICS_API_HIDDEN_OPERATIONS[option_key])

    return operations_config


def get_available_mris(
    organization: Organization, projects: Sequence[Project], use_case_id: UseCaseID
) -> dict[str, list[int]]:
    """
    Returns a dictionary containing the Metrics MRIs available as keys, and the corresponding
    list of project_ids in which the MRI is available as values.
    """
    project_ids = [project.id for project in projects]
    project_id_to_mris = fetch_metric_mris(organization.id, project_ids, use_case_id)
    mris_to_project_ids = _convert_to_mris_to_project_ids_mapping(project_id_to_mris)

    return mris_to_project_ids


def _convert_to_mris_to_project_ids_mapping(project_id_to_mris: dict[int, list[str]]):
    mris_to_project_ids: dict[str, list[int]] = defaultdict(list)

    mris_to_project_ids = {}
    for project_id, mris in project_id_to_mris.items():
        for mri in mris:
            mris_to_project_ids.setdefault(mri, []).append(project_id)

    return mris_to_project_ids


def _build_metric_meta(
    parsed_mri: ParsedMRI,
    project_ids: Sequence[int],
    blocking_status: Sequence[BlockedMetric],
    operations_config: OperationsConfiguration,
) -> MetricMeta:
    available_operations = get_available_operations(parsed_mri)
    available_operations = [
        operation
        for operation in available_operations
        if operation not in operations_config.get_hidden_operations()
    ]

    return MetricMeta(
        type=cast(MetricType, parsed_mri.entity),
        name=parsed_mri.name,
        unit=cast(MetricUnit, parsed_mri.unit),
        mri=parsed_mri.mri_string,
        operations=cast(Sequence[MetricOperationType], available_operations),
        projectIds=project_ids,
        blockingStatus=blocking_status,
        customMeta={},
    )
