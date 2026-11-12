from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import timedelta
from typing import Any, TypedDict

from sentry.incidents.handlers.condition import *  # noqa
from sentry.incidents.metric_issue_detector import MetricIssueDetectorValidator
from sentry.incidents.models.alert_rule import AlertRuleDetectionType, ComparisonDeltaChoices
from sentry.incidents.utils.format_duration import format_duration_idiomatic
from sentry.incidents.utils.types import (
    AnomalyDetectionUpdate,
    AnomalyDetectionValues,
    ProcessedSubscriptionUpdate,
)
from sentry.integrations.metric_alerts import TEXT_COMPARISON_DELTA, describe_query_metric
from sentry.issues.grouptype import GroupCategory, GroupType
from sentry.ratelimits.sliding_windows import Quota
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.types.actor import parse_and_validate_actor
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.handlers.detector import DetectorOccurrence, StatefulDetectorHandler
from sentry.workflow_engine.handlers.detector.base import EventData, EvidenceData
from sentry.workflow_engine.models.alertrule_detector import AlertRuleDetector
from sentry.workflow_engine.models.data_condition import Condition, DataCondition
from sentry.workflow_engine.models.data_source import DataPacket
from sentry.workflow_engine.processors import DataConditionGroupEvaluation, DetectorEvaluation
from sentry.workflow_engine.registry import detector_settings_registry
from sentry.workflow_engine.types import (
    DetectorException,
    DetectorPriorityLevel,
    DetectorSettings,
    DetectorType,
)

logger = logging.getLogger(__name__)

MetricUpdate = ProcessedSubscriptionUpdate | AnomalyDetectionUpdate

MetricResult = float | AnomalyDetectionValues


# Post-serialization: what's stored in evidence data after JSON round-trip.
class StoredAnomalyDetectionResult(TypedDict):
    value: float
    source_id: str
    subscription_id: str
    timestamp: str


StoredMetricResult = float | StoredAnomalyDetectionResult | None


@dataclass
class MetricIssueEvidenceData(EvidenceData[StoredMetricResult]):
    alert_id: int


class MetricIssueDetectorHandler(StatefulDetectorHandler[MetricUpdate, MetricResult]):
    regression_timeout = timedelta(hours=24)

    def build_detector_evidence_data(
        self,
        group_evaluation: DataConditionGroupEvaluation | None,
        data_packet: DataPacket[MetricUpdate],
        priority: DetectorPriorityLevel,
    ) -> dict[str, Any]:
        try:
            alert_rule_detector = AlertRuleDetector.objects.get(detector=self.detector)
            return {"alert_id": alert_rule_detector.alert_rule_id}
        except AlertRuleDetector.DoesNotExist:
            logger.warning(
                "No alert rule detector found for detector id %s",
                self.detector.id,
                extra={
                    "detector_id": self.detector.id,
                },
            )
            return {"alert_id": None}

    def create_occurrence(
        self,
        evaluation: DetectorEvaluation,
        data_packet: DataPacket[MetricUpdate],
    ) -> tuple[DetectorOccurrence, EventData]:
        priority = evaluation.priority

        try:
            detector_trigger = DataCondition.objects.get(
                condition_group=self.detector.workflow_condition_group, condition_result=priority
            )
        except DataCondition.DoesNotExist:
            raise DetectorException(
                f"Failed to find detector trigger for detector id {self.detector.id}, cannot create metric issue occurrence"
            )

        try:
            query_subscription = QuerySubscription.objects.get(id=data_packet.source_id)
        except QuerySubscription.DoesNotExist:
            raise DetectorException(
                f"Failed to find query subscription for detector id {self.detector.id}, cannot create metric issue occurrence"
            )

        try:
            snuba_query = SnubaQuery.objects.get(id=query_subscription.snuba_query_id)
        except SnubaQuery.DoesNotExist:
            raise DetectorException(
                f"Failed to find snuba query for detector id {self.detector.id}, cannot create metric issue occurrence"
            )

        try:
            owner = self.detector.owner.identifier if self.detector.owner else None
            assignee = parse_and_validate_actor(owner, self.detector.linked_project.organization_id)
        except Exception:
            logger.exception("Failed to parse assignee for detector id %s", self.detector.id)
            assignee = None

        return (
            DetectorOccurrence(
                issue_title=self.detector.name,
                subtitle=self.construct_title(snuba_query, detector_trigger, priority),
                evidence_data={
                    **self.build_detector_evidence_data(
                        evaluation.data["trigger_group_evaluation"], data_packet, priority
                    ),
                },
                evidence_display=[],  # XXX: may need to pass more info here for the front end
                type=MetricIssue,
                level="error",
                culprit="",
                assignee=assignee,
                priority=priority,
            ),
            {
                "environment": (snuba_query.environment.name if snuba_query.environment else None),
            },
        )

    def extract_dedupe_value(self, data_packet: DataPacket[MetricUpdate]) -> int:
        return int(data_packet.packet.timestamp.timestamp())

    def extract_value(self, data_packet: DataPacket[MetricUpdate]) -> MetricResult:
        if isinstance(data_packet.packet, AnomalyDetectionUpdate):
            return data_packet.packet.values
        return data_packet.packet.values["value"]

    def construct_title(
        self,
        snuba_query: SnubaQuery,
        detector_trigger: DataCondition,
        priority: DetectorPriorityLevel,
    ) -> str:
        detection_type = self.detector.config.get("detection_type")
        is_percent_detector = detection_type == AlertRuleDetectionType.PERCENT
        metric = describe_query_metric(snuba_query)

        if detection_type == "dynamic":
            return f"Detected an anomaly in {metric}"

        # Determine the higher or lower comparison
        higher_or_lower = ""
        if detector_trigger.type == Condition.GREATER:
            higher_or_lower = "greater than" if is_percent_detector else "above"
        else:
            higher_or_lower = "less than" if is_percent_detector else "below"

        label = "Warning" if priority == DetectorPriorityLevel.MEDIUM else "Critical"

        # Format the time window for the threshold
        time_window = format_duration_idiomatic(snuba_query.time_window // 60)

        # For percent detectors, format the comparison string
        comparison: str | int | float = "threshold"
        if is_percent_detector:
            comparison_delta_sec = self.detector.config.get("comparison_delta")
            comparison_delta_minutes = comparison_delta_sec // 60
            comparison = TEXT_COMPARISON_DELTA.get(
                comparison_delta_minutes, f"same time {comparison_delta_minutes} minutes ago "
            )
        else:
            comparison = detector_trigger.comparison

        template = "{label}: {metric} in the last {time_window} {higher_or_lower} {comparison}"
        return template.format(
            label=label.capitalize(),
            metric=metric,
            higher_or_lower=higher_or_lower,
            comparison=comparison,
            time_window=time_window,
        )


@dataclass(frozen=True)
class MetricIssue(GroupType):
    type_id = 8001
    slug = "metric_issue"
    description = "Metric issue triggered"
    category = GroupCategory.METRIC.value
    creation_quota = Quota(3600, 60, 1000)
    default_priority = PriorityLevel.HIGH
    released = True
    enable_auto_resolve = False
    enable_escalation_detection = False
    enable_status_change_workflow_notifications = False
    enable_workflow_notifications = False
    enable_user_status_and_priority_changes = False


@detector_settings_registry.register(DetectorType.METRIC_ISSUE)
class MetricIssueDetectorSettings(DetectorSettings):
    handler = MetricIssueDetectorHandler
    validator = MetricIssueDetectorValidator
    config_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "description": "A representation of a metric detector config dict",
        "type": "object",
        "required": ["detection_type"],
        "properties": {
            "comparison_delta": {
                "type": "integer",
                "enum": [choice.value for choice in ComparisonDeltaChoices],
            },
            "detection_type": {
                "type": "string",
                "enum": [detection_type.value for detection_type in AlertRuleDetectionType],
            },
        },
        # The API drops unknown keys before validating, so this only rejects ones written by other
        # code
        "additionalProperties": False,
        # Only percent detectors have a `comparison_delta`
        "if": {
            # Without `required`, the condition would also match when `detection_type` is missing
            "required": ["detection_type"],
            "properties": {"detection_type": {"const": AlertRuleDetectionType.PERCENT.value}},
        },
        "then": {"required": ["comparison_delta"]},
        "else": {"not": {"required": ["comparison_delta"]}},
    }
