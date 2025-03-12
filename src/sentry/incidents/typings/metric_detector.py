from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sentry.incidents.models.alert_rule import (
    AlertRule,
    AlertRuleDetectionType,
    AlertRuleThresholdType,
    AlertRuleTriggerAction,
)
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.workflow_engine.models import Action, Detector


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


@dataclass
class NotificationContext:
    """
    NotificationContext is a dataclass that represents the context required send a notification.
    """

    integration_id: int | None = None
    target_identifier: str | None = None
    target_display: str | None = None
    sentry_app_config: list[dict[str, Any]] | dict[str, Any] | None = None
    sentry_app_id: str | None = None

    @classmethod
    def from_alert_rule_trigger_action(cls, action: AlertRuleTriggerAction) -> NotificationContext:
        return cls(
            integration_id=action.integration_id,
            target_identifier=action.target_identifier,
            target_display=action.target_display,
            sentry_app_config=action.sentry_app_config,
        )

    @classmethod
    def from_action_model(cls, action: Action) -> NotificationContext:
        if action.type == Action.Type.SENTRY_APP:
            return cls(
                integration_id=action.integration_id,
                target_display=action.config.get("target_display"),
                sentry_app_config=action.data.get("settings"),
                sentry_app_id=action.data.get("target_identifier"),
                # Does not need data
            )
        elif action.type == Action.Type.OPSGENIE or action.type == Action.Type.PAGERDUTY:
            return cls(
                integration_id=action.integration_id,
                target_identifier=action.config.get("target_identifier"),
                target_display=action.config.get("target_display"),
                sentry_app_config=action.data,
            )
        # TODO(iamrajjoshi): Add support for email here

        return cls(
            integration_id=action.integration_id,
            target_identifier=action.config.get("target_identifier"),
            target_display=action.config.get("target_display"),
        )
