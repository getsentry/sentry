from __future__ import annotations

from dataclasses import dataclass

from sentry.incidents.models.alert_rule import (
    AlertRule,
    AlertRuleDetectionType,
    AlertRuleThresholdType,
)
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.workflow_engine.models import Detector


@dataclass
class AlertContext:
    name: str
    action_identifier_id: int
    threshold_type: AlertRuleThresholdType | None
    detection_type: AlertRuleDetectionType
    comparison_delta: int | None

    @classmethod
    def from_alert_rule_incident(cls, alert_rule: AlertRule) -> AlertContext:
        return cls(
            name=alert_rule.name,
            action_identifier_id=alert_rule.id,
            threshold_type=AlertRuleThresholdType(alert_rule.threshold_type),
            detection_type=AlertRuleDetectionType(alert_rule.detection_type),
            comparison_delta=alert_rule.comparison_delta,
        )

    @classmethod
    def from_workflow_engine_models(
        cls, detector: Detector, issue_occurrence: IssueOccurrence
    ) -> AlertContext:
        # TODO(iamrajjoshi): Finalize the fetch from issue_occurrence once we have evidence_data contract
        threshold_type = issue_occurrence.evidence_data.get("threshold_type")
        if threshold_type is not None:
            threshold_type = AlertRuleThresholdType(threshold_type)
        return cls(
            name=detector.name,
            action_identifier_id=detector.id,
            threshold_type=threshold_type,
            detection_type=detector.config.get("detection_type"),
            comparison_delta=detector.config.get("comparison_delta"),
        )
