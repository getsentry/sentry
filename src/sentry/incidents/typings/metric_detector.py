from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sentry.incidents.models.alert_rule import (
    AlertRule,
    AlertRuleDetectionType,
    AlertRuleThresholdType,
    AlertRuleTriggerAction,
)
from sentry.incidents.models.incident import Incident, IncidentStatus
from sentry.models.group import Group, GroupStatus
from sentry.models.groupopenperiod import get_latest_open_period
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.workflow_engine.models import Action, Condition, Detector
from sentry.workflow_engine.types import DetectorPriorityLevel

if TYPE_CHECKING:
    from sentry.incidents.grouptype import MetricIssueEvidenceData
    from sentry.seer.anomaly_detection.types import AnomalyDetectionThresholdType

CONDITION_TO_ALERT_RULE_THRESHOLD_TYPE = {
    Condition.GREATER_OR_EQUAL: AlertRuleThresholdType.ABOVE,
    Condition.GREATER: AlertRuleThresholdType.ABOVE,
    Condition.LESS_OR_EQUAL: AlertRuleThresholdType.BELOW,
    Condition.LESS: AlertRuleThresholdType.BELOW,
}


def fetch_threshold_type(
    condition: dict[str, Any],
) -> AlertRuleThresholdType | AnomalyDetectionThresholdType:
    condition_type = condition["type"]
    if condition_type == Condition.ANOMALY_DETECTION:
        return condition["comparison"]["threshold_type"]
    return CONDITION_TO_ALERT_RULE_THRESHOLD_TYPE[condition_type]


def fetch_alert_threshold(condition: dict[str, Any], group_status: GroupStatus) -> float | None:
    condition_type = condition["type"]
    if condition_type == Condition.ANOMALY_DETECTION:
        return 0
    comparison_value = condition["comparison"]
    if group_status == GroupStatus.RESOLVED or group_status == GroupStatus.IGNORED:
        return None
    else:
        return comparison_value


def fetch_resolve_threshold(condition: dict[str, Any], group_status: GroupStatus) -> float | None:
    """
    This is the opposite of `fetch_alert_threshold`.
    We keep it explicitly separate to make it clear that we are fetching the resolve threshold and to consolidate tech debt.
    """
    condition_type = condition["type"]
    if condition_type == Condition.ANOMALY_DETECTION:
        return 0
    comparison_value = condition["comparison"]
    if group_status == GroupStatus.RESOLVED or group_status == GroupStatus.IGNORED:
        return comparison_value
    else:
        return None


def fetch_sensitivity(condition: dict[str, Any]) -> str | None:
    if condition.get("type") == Condition.ANOMALY_DETECTION:
        return condition.get("comparison", {}).get("sensitivity", None)
    return None


@dataclass
class AlertContext:
    name: str
    action_identifier_id: int
    threshold_type: AlertRuleThresholdType | None | AnomalyDetectionThresholdType
    detection_type: AlertRuleDetectionType
    comparison_delta: int | None
    sensitivity: str | None
    resolve_threshold: float | None
    alert_threshold: float | None

    @classmethod
    def from_alert_rule_incident(
        cls, alert_rule: AlertRule, alert_rule_threshold: float | None = None
    ) -> AlertContext:
        resolve_threshold = alert_rule.resolve_threshold

        if alert_rule.detection_type == AlertRuleDetectionType.DYNAMIC:
            alert_rule_threshold = 0
            resolve_threshold = 0

        return cls(
            name=alert_rule.name,
            action_identifier_id=alert_rule.id,
            threshold_type=AlertRuleThresholdType(alert_rule.threshold_type),
            detection_type=AlertRuleDetectionType(alert_rule.detection_type),
            comparison_delta=alert_rule.comparison_delta,
            sensitivity=alert_rule.sensitivity,
            alert_threshold=alert_rule_threshold,
            resolve_threshold=resolve_threshold,
        )

    @classmethod
    def from_workflow_engine_models(
        cls,
        detector: Detector,
        evidence_data: MetricIssueEvidenceData,
        group_status: GroupStatus,
        detector_priority_level: DetectorPriorityLevel,
    ) -> AlertContext:
        try:
            condition = next(
                cond
                for cond in evidence_data.conditions
                if cond["condition_result"] == detector_priority_level
                # If the condition is an anomaly detection condition, the condition_result is just a placeholder, but that is the condition we want to use
                or cond["type"] == Condition.ANOMALY_DETECTION
            )
            threshold_type = fetch_threshold_type(condition)
            resolve_threshold = fetch_resolve_threshold(condition, group_status)
            alert_threshold = fetch_alert_threshold(condition, group_status)
            sensitivity = fetch_sensitivity(condition)
        except StopIteration:
            raise ValueError("No threshold type found for metric issues")

        return cls(
            name=detector.name,
            action_identifier_id=detector.id,
            threshold_type=threshold_type,
            detection_type=AlertRuleDetectionType(detector.config.get("detection_type")),
            comparison_delta=detector.config.get("comparison_delta"),
            sensitivity=sensitivity,
            resolve_threshold=resolve_threshold,
            alert_threshold=alert_threshold,
        )


@dataclass
class NotificationContext:
    """
    NotificationContext is a dataclass that represents the context required send a notification.
    """

    id: int
    integration_id: int | None = None
    target_identifier: str | None = None
    target_display: str | None = None
    target_type: ActionTarget | None = None
    sentry_app_config: list[dict[str, Any]] | dict[str, Any] | None = None
    sentry_app_id: str | None = None

    @classmethod
    def from_alert_rule_trigger_action(cls, action: AlertRuleTriggerAction) -> NotificationContext:
        return cls(
            id=action.id,
            integration_id=action.integration_id,
            target_identifier=action.target_identifier,
            target_display=action.target_display,
            sentry_app_config=action.sentry_app_config,
            sentry_app_id=str(action.sentry_app_id) if action.sentry_app_id else None,
            target_type=ActionTarget(action.target_type),
        )

    @classmethod
    def from_action_model(cls, action: Action) -> NotificationContext:
        if action.type == Action.Type.SENTRY_APP:
            return cls(
                id=action.id,
                integration_id=None,
                target_display=None,
                target_identifier=None,
                sentry_app_config=action.data.get("settings"),
                sentry_app_id=action.config.get("target_identifier"),
                # For Sentry Apps, we use `sentry_app_config` and don't pass `data`
            )
        elif action.type == Action.Type.OPSGENIE or action.type == Action.Type.PAGERDUTY:
            return cls(
                id=action.id,
                integration_id=action.integration_id,
                target_identifier=action.config.get("target_identifier"),
                target_display=action.config.get("target_display"),
                sentry_app_config=action.data,
            )
        elif action.type == Action.Type.EMAIL:
            return cls(
                id=action.id,
                integration_id=None,
                target_identifier=action.config.get("target_identifier"),
                target_display=None,
                target_type=ActionTarget(action.config.get("target_type")),
            )
        return cls(
            id=action.id,
            integration_id=action.integration_id,
            target_identifier=action.config.get("target_identifier"),
            target_display=action.config.get("target_display"),
        )


@dataclass
class MetricIssueContext:
    id: int
    open_period_identifier: int  # Used for link building
    title: str
    snuba_query: SnubaQuery
    new_status: IncidentStatus
    subscription: QuerySubscription | None
    metric_value: float | dict | None
    group: Group | None

    @classmethod
    def _get_new_status(
        cls, group: Group, detector_priority_level: DetectorPriorityLevel
    ) -> IncidentStatus:
        if group.status == GroupStatus.RESOLVED:
            return IncidentStatus.CLOSED
        elif detector_priority_level == DetectorPriorityLevel.MEDIUM:
            return IncidentStatus.WARNING
        elif detector_priority_level == DetectorPriorityLevel.OK:
            return IncidentStatus.CLOSED
        else:
            return IncidentStatus.CRITICAL

    @classmethod
    def _get_subscription(cls, evidence_data: MetricIssueEvidenceData) -> QuerySubscription:
        subscription = QuerySubscription.objects.get(id=int(evidence_data.data_packet_source_id))
        return subscription

    @classmethod
    def from_group_event(
        cls,
        group: Group,
        evidence_data: MetricIssueEvidenceData,
        detector_priority_level: DetectorPriorityLevel,
    ) -> MetricIssueContext:
        open_period = get_latest_open_period(group)
        if open_period is None:
            raise ValueError("No open periods found for group")

        subscription = cls._get_subscription(evidence_data)
        snuba_query = subscription.snuba_query

        return cls(
            id=group.id,
            open_period_identifier=open_period.id,
            snuba_query=snuba_query,
            subscription=subscription,
            new_status=cls._get_new_status(group, detector_priority_level),
            metric_value=evidence_data.value,
            group=group,
            title=group.title,
        )

    @classmethod
    def from_legacy_models(
        cls,
        incident: Incident,
        new_status: IncidentStatus,
        metric_value: float | None = None,
    ) -> MetricIssueContext:
        return cls(
            id=incident.id,
            open_period_identifier=incident.identifier,
            snuba_query=incident.alert_rule.snuba_query,
            subscription=incident.subscription,
            new_status=new_status,
            metric_value=metric_value,
            group=None,
            title=incident.title,
        )


@dataclass
class OpenPeriodContext:
    """
    We want to eventually delete this class. it serves as a way to pass data around
    that we used to use `incident` for.
    """

    date_started: datetime
    date_closed: datetime | None
    id: int

    @classmethod
    def from_incident(cls, incident: Incident) -> OpenPeriodContext:
        return cls(
            date_started=incident.date_added, date_closed=incident.date_closed, id=incident.id
        )

    @classmethod
    def from_group(cls, group: Group) -> OpenPeriodContext:
        open_period = get_latest_open_period(group)
        if open_period is None:
            raise ValueError("No open periods found for group")
        return cls(
            date_started=open_period.date_started,
            date_closed=open_period.date_ended,
            id=open_period.id,
        )
