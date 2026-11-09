from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import timedelta

from django.utils import timezone
from sentry_sdk import traces

from sentry.constants import ObjectStatus
from sentry.incidents.grouptype import MetricIssue, MetricIssueDetectorHandler, MetricUpdate
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.incidents.utils.subscription_limits import is_metric_subscription_allowed
from sentry.incidents.utils.types import (
    DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
    ProcessedSubscriptionUpdate,
)
from sentry.investigations.services.breached_metrics import code_mode_dataset
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.occurrence_consumer import process_occurrence_message
from sentry.models.group import Group
from sentry.models.groupopenperiod import should_create_open_periods
from sentry.models.organization import Organization
from sentry.seer.models.workflow import SeerWorkflowConfig, SeerWorkflowStrategy
from sentry.seer.workflows.breached_metrics import BreachedMetricWorkflow
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import QuerySubscription
from sentry.workflow_engine.models import DataCondition, DataPacket, DataSourceDetector, Detector
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel


class SyntheticBreachError(Exception):
    def __init__(self, detail: str, status_code: int) -> None:
        super().__init__(detail)
        self.status_code = status_code


@dataclass(frozen=True)
class SyntheticBreachContext:
    detector: Detector
    subscription: QuerySubscription
    condition: DataCondition


def prepare_synthetic_breach(
    organization: Organization, detector: Detector
) -> SyntheticBreachContext:
    if (
        detector.type != MetricIssue.slug
        or detector.status != ObjectStatus.ACTIVE
        or not detector.enabled
        or detector.project is None
        or detector.project.status != ObjectStatus.ACTIVE
        or not should_create_open_periods(MetricIssue.type_id)
    ):
        raise SyntheticBreachError("The monitor is not an enabled, active metric monitor.", 409)

    condition = (
        detector.get_conditions()
        .exclude(condition_result=DetectorPriorityLevel.OK)
        .order_by("-condition_result", "id")
        .first()
    )
    if condition is None or condition.condition_result not in (
        DetectorPriorityLevel.LOW,
        DetectorPriorityLevel.MEDIUM,
        DetectorPriorityLevel.HIGH,
    ):
        raise SyntheticBreachError("The monitor has no usable breach condition.", 409)
    try:
        AlertRuleDetectionType(detector.config.get("detection_type"))
    except (ValueError, TypeError):
        raise SyntheticBreachError("The monitor has an unsupported detection type.", 409)

    sources = list(
        DataSourceDetector.objects.filter(
            detector=detector,
            data_source__organization_id=organization.id,
            data_source__type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
        ).select_related("data_source")
    )
    if len(sources) != 1:
        raise SyntheticBreachError("The monitor must have one metric query source.", 409)
    try:
        subscription_id = int(sources[0].data_source.source_id)
        subscription = (
            QuerySubscription.objects.select_related("snuba_query", "snuba_query__environment")
            .prefetch_related("snuba_query__snubaqueryeventtype_set")
            .get(id=subscription_id, project_id=detector.project_id)
        )
        dataset = Dataset(subscription.snuba_query.dataset)
    except (TypeError, ValueError, QuerySubscription.DoesNotExist):
        raise SyntheticBreachError("The monitor's query source is unavailable.", 409)
    query = subscription.snuba_query
    if code_mode_dataset(dataset, query.event_types) is None or not is_metric_subscription_allowed(
        query.dataset, organization
    ):
        raise SyntheticBreachError("The monitor's dataset cannot be investigated.", 409)

    configs = SeerWorkflowConfig.objects.filter(
        organization_id=organization.id,
        strategy=SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION,
        enabled=True,
        backing_workflow__status=ObjectStatus.ACTIVE,
        backing_workflow__enabled=True,
        backing_workflow__detectorworkflow__detector=detector,
    )
    environment = query.environment.name if query.environment else None
    if not any(
        BreachedMetricWorkflow(config_id=config.id, organization_id=organization.id).matches_scope(
            detector.project_id, environment
        )
        for config in configs
    ):
        raise SyntheticBreachError(
            "The monitor has no enabled, environment-compatible automation.", 409
        )
    return SyntheticBreachContext(detector, subscription, condition)


def synthetic_value(condition: DataCondition) -> float:
    if condition.type == Condition.ANOMALY_DETECTION:
        return 1.0
    comparison = condition.comparison
    if isinstance(comparison, bool) or not isinstance(comparison, (int, float)):
        raise SyntheticBreachError("The monitor has an unsupported breach condition.", 409)
    threshold = float(comparison)
    if not math.isfinite(threshold):
        raise SyntheticBreachError("The monitor has an invalid threshold.", 409)
    delta = max(abs(threshold) * 0.1, 1.0)
    if condition.type in (Condition.GREATER, Condition.GREATER_OR_EQUAL):
        value = threshold + delta
    elif condition.type in (Condition.LESS, Condition.LESS_OR_EQUAL):
        value = threshold - delta
    else:
        raise SyntheticBreachError("The monitor has an unsupported breach condition.", 409)
    if not math.isfinite(value):
        raise SyntheticBreachError(
            "The monitor's threshold cannot produce finite test evidence.", 409
        )
    return value


def create_synthetic_breach(context: SyntheticBreachContext) -> tuple[Group, str]:
    submitted_at = timezone.now()
    breach_start = submitted_at - timedelta(minutes=15)
    value = synthetic_value(context.condition)
    packet = DataPacket[MetricUpdate](
        source_id=str(context.subscription.id),
        packet=ProcessedSubscriptionUpdate(
            entity="admin-synthetic-metric-breach",
            subscription_id=str(context.subscription.id),
            values={"value": value},
            timestamp=breach_start,
        ),
    )
    handler = MetricIssueDetectorHandler(context.detector)
    evaluation = handler.create_synthetic_occurrence(
        packet, DetectorPriorityLevel(context.condition.condition_result), value
    )
    occurrence = evaluation.result
    assert isinstance(occurrence, IssueOccurrence)
    assert evaluation.data["event_data"] is not None
    payload = {
        **occurrence.to_dict(),
        "event": {
            **evaluation.data["event_data"],
            "timestamp": breach_start.isoformat(),
            "received": submitted_at.isoformat(),
        },
    }
    with traces.start_span(name="seer.synthetic_metric_breach") as span:
        result = process_occurrence_message(payload, span)
    if result is not None:
        saved_occurrence, group_info = result
        if group_info is not None:
            return group_info.group, saved_occurrence.event_id
    raise SyntheticBreachError("Synthetic breach was dropped by ingestion controls.", 409)
