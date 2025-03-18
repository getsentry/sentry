from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sentry.eventstore.models import GroupEvent
from sentry.incidents.models.alert_rule import (
    AlertRule,
    AlertRuleDetectionType,
    AlertRuleThresholdType,
    AlertRuleTriggerAction,
)
from sentry.incidents.models.incident import Incident, IncidentStatus
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.models.group import Group, GroupStatus
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.types.group import PriorityLevel
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

    id: int
    integration_id: int | None = None
    target_identifier: str | None = None
    target_display: str | None = None
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
        )

    @classmethod
    def from_action_model(cls, action: Action) -> NotificationContext:
        if action.type == Action.Type.SENTRY_APP:
            return cls(
                id=action.id,
                integration_id=action.integration_id,
                target_display=action.config.get("target_display"),
                sentry_app_config=action.data.get("settings"),
                sentry_app_id=action.data.get("target_identifier"),
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
        # TODO(iamrajjoshi): Add support for email here

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
    snuba_query: SnubaQuery
    subscription: QuerySubscription
    new_status: IncidentStatus
    metric_value: float | None

    @classmethod
    def _get_new_status(cls, group: Group, occurrence: IssueOccurrence) -> IncidentStatus:
        if group.status == GroupStatus.RESOLVED:
            return IncidentStatus.CLOSED
        elif occurrence.initial_issue_priority == PriorityLevel.MEDIUM.value:
            return IncidentStatus.WARNING
        else:
            return IncidentStatus.CRITICAL

    @classmethod
    def _get_snuba_query(cls, occurrence: IssueOccurrence) -> SnubaQuery:
        snuba_query_id = occurrence.evidence_data.get("snuba_query_id")
        if not snuba_query_id:
            raise ValueError("Snuba query ID is required for alert context")
        try:
            query = SnubaQuery.objects.get(id=snuba_query_id)
        except SnubaQuery.DoesNotExist as e:
            raise ValueError("Snuba query does not exist") from e
        return query

    @classmethod
    def _get_subscription(cls, occurrence: IssueOccurrence) -> QuerySubscription:
        subscription_id = occurrence.evidence_data.get("subscription_id")
        if not subscription_id:
            raise ValueError("Subscription ID is required for alert context")
        try:
            subscription = QuerySubscription.objects.get(id=subscription_id)
        except QuerySubscription.DoesNotExist as e:
            raise ValueError("Subscription does not exist") from e
        return subscription

    @classmethod
    def _get_metric_value(cls, occurrence: IssueOccurrence) -> float:
        if (metric_value := occurrence.evidence_data.get("metric_value")) is None:
            raise ValueError("Metric value is required for alert context")
        return metric_value

    @classmethod
    def from_group_event(cls, group_event: GroupEvent) -> MetricIssueContext:
        group = group_event.group
        occurrence = group_event.occurrence
        if occurrence is None:
            raise ValueError("Occurrence is required for alert context")
        return cls(
            # TODO(iamrajjoshi): Replace with something once we know how we want to build the link
            # If we store open periods in the database, we can use the id from that
            # Otherwise, we can use the issue id
            id=group.id,
            # TODO(iamrajjoshi): This should probably be the id of the latest open period
            open_period_identifier=group.id,
            snuba_query=cls._get_snuba_query(occurrence),
            subscription=cls._get_subscription(occurrence),
            new_status=cls._get_new_status(group, occurrence),
            metric_value=cls._get_metric_value(occurrence),
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
        )


@dataclass
class OpenPeriodContext:
    """
    We want to eventually delete this class. it serves as a way to pass data around
    that we used to use `incident` for.
    """

    date_started: datetime
    date_closed: datetime | None

    @classmethod
    def from_incident(cls, incident: Incident) -> OpenPeriodContext:
        return cls(
            date_started=incident.date_added,
            date_closed=incident.date_closed,
        )
