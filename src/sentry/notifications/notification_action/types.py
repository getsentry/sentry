import logging
import uuid
from abc import ABC, abstractmethod
from collections.abc import Callable, Collection, Sequence
from dataclasses import asdict
from typing import Any, NotRequired, TypedDict

import sentry_sdk

from sentry import features
from sentry.constants import ObjectStatus
from sentry.eventstore.models import GroupEvent
from sentry.incidents.grouptype import MetricIssueEvidenceData
from sentry.incidents.models.incident import TriggerStatus
from sentry.incidents.typings.metric_detector import (
    AlertContext,
    MetricIssueContext,
    NotificationContext,
    OpenPeriodContext,
)
from sentry.models.group import Group, GroupStatus
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.rule import Rule, RuleSource
from sentry.rules.processing.processor import activate_downstream_actions
from sentry.types.rules import RuleFuture
from sentry.utils.safe import safe_execute
from sentry.workflow_engine.models import Action, AlertRuleWorkflow, Detector
from sentry.workflow_engine.types import WorkflowEventData
from sentry.workflow_engine.typings.notification_action import (
    ACTION_FIELD_MAPPINGS,
    ActionFieldMapping,
    ActionFieldMappingKeys,
    TicketFieldMappingKeys,
)

logger = logging.getLogger(__name__)


class RuleData(TypedDict):
    actions: list[dict[str, Any]]
    legacy_rule_id: NotRequired[int]


class LegacyRegistryHandler(ABC):
    """
    Abstract base class that defines the interface for notification handlers.
    """

    @staticmethod
    @abstractmethod
    def handle_workflow_action(job: WorkflowEventData, action: Action, detector: Detector) -> None:
        """
        Implement this method to handle the specific notification logic for your handler.
        """
        raise NotImplementedError


class BaseIssueAlertHandler(ABC):
    """
    Base class for invoking the legacy issue alert registry.
    """

    @staticmethod
    def get_integration_id(action: Action, mapping: ActionFieldMapping) -> dict[str, Any]:
        if mapping.get(ActionFieldMappingKeys.INTEGRATION_ID_KEY.value):
            if action.integration_id is None:
                raise ValueError(f"No integration id found for action type: {action.type}")
            return {mapping[ActionFieldMappingKeys.INTEGRATION_ID_KEY.value]: action.integration_id}
        raise ValueError(f"No integration id key found for action type: {action.type}")

    @classmethod
    def get_target_identifier(
        cls, action: Action, mapping: ActionFieldMapping, organization_id: int
    ) -> dict[str, Any]:
        if mapping.get(ActionFieldMappingKeys.TARGET_IDENTIFIER_KEY.value):
            target_id = action.config.get("target_identifier")

            if target_id is None:
                raise ValueError(f"No target_identifier found for action type: {action.type}")
            return {mapping[ActionFieldMappingKeys.TARGET_IDENTIFIER_KEY.value]: target_id}
        raise ValueError(f"No target_identifier key found for action type: {action.type}")

    @classmethod
    def get_target_display(cls, action: Action, mapping: ActionFieldMapping) -> dict[str, Any]:
        if mapping.get(ActionFieldMappingKeys.TARGET_DISPLAY_KEY.value):
            target_display = action.config.get("target_display")
            if target_display is None:
                raise ValueError(f"No target display found for action type: {action.type}")
            return {mapping[ActionFieldMappingKeys.TARGET_DISPLAY_KEY.value]: target_display}
        raise ValueError(f"No target display key found for action type: {action.type}")

    @classmethod
    def get_additional_fields(cls, action: Action, mapping: ActionFieldMapping) -> dict[str, Any]:
        """Add additional fields to the blob"""
        return {}

    @classmethod
    def build_rule_action_blob(
        cls,
        action: Action,
        organization_id: int,
    ) -> dict[str, Any]:
        """Build the base action blob using the standard mapping"""
        mapping = ACTION_FIELD_MAPPINGS.get(Action.Type(action.type))
        if mapping is None:
            raise ValueError(f"No mapping found for action type: {action.type}")
        blob: dict[str, Any] = {
            "id": mapping["id"],
        }

        blob.update(cls.get_integration_id(action, mapping))
        blob.update(cls.get_target_identifier(action, mapping, organization_id))
        blob.update(cls.get_target_display(action, mapping))
        blob.update(cls.get_additional_fields(action, mapping))
        return blob

    @classmethod
    def create_rule_instance_from_action(
        cls,
        action: Action,
        detector: Detector,
        job: WorkflowEventData,
    ) -> Rule:
        """
        Creates a Rule instance from the Action model.
        :param action: Action
        :param detector: Detector
        :param job: WorkflowEventData
        :return: Rule instance
        """
        environment_id = job.workflow_env.id if job.workflow_env else None

        data: RuleData = {
            "actions": [cls.build_rule_action_blob(action, detector.project.organization.id)],
        }

        workflow_id = getattr(action, "workflow_id", None)

        label = detector.name
        # We need to pass the legacy rule id when the workflow-engine-ui-links feature flag is disabled
        # This is so we can build the old link to the rule
        if not features.has(
            "organizations:workflow-engine-ui-links", detector.project.organization
        ):
            if workflow_id is None:
                raise ValueError("Workflow ID is required when triggering an action")

            # If test event, just set the legacy rule id to -1
            if workflow_id == -1:
                data["actions"][0]["legacy_rule_id"] = -1
            else:
                try:
                    alert_rule_workflow = AlertRuleWorkflow.objects.get(
                        workflow_id=workflow_id,
                    )
                except AlertRuleWorkflow.DoesNotExist:
                    raise ValueError(
                        "AlertRuleWorkflow not found when querying for AlertRuleWorkflow"
                    )

                if alert_rule_workflow.rule_id is None:
                    raise ValueError("Rule not found when querying for AlertRuleWorkflow")

                data["actions"][0]["legacy_rule_id"] = alert_rule_workflow.rule_id

                # Get the legacy rule label
                try:
                    rule = Rule.objects.get(id=alert_rule_workflow.rule_id)
                    label = rule.label
                except Rule.DoesNotExist:
                    logger.exception(
                        "Rule not found when querying for AlertRuleWorkflow",
                        extra={"rule_id": alert_rule_workflow.rule_id},
                    )
                    # We shouldn't fail badly here since we can still send the notification, so just set it to the rule id
                    label = f"Rule {alert_rule_workflow.rule_id}"

        # In the new UI, we need this for to build the link to the new rule in the notification action
        else:
            data["actions"][0]["workflow_id"] = workflow_id

        rule = Rule(
            id=action.id,
            project=detector.project,
            environment_id=environment_id,
            label=label,
            data=dict(data),
            status=ObjectStatus.ACTIVE,
            source=RuleSource.ISSUE,
        )

        return rule

    @staticmethod
    def get_rule_futures(
        job: WorkflowEventData,
        rule: Rule,
        notification_uuid: str,
    ) -> Collection[tuple[Callable[[GroupEvent, Sequence[RuleFuture]], None], list[RuleFuture]]]:
        """
        This method will collect the futures from the activate_downstream_actions method.
        Based off of rule_processor.apply in rules/processing/processor.py
        """
        with sentry_sdk.start_span(
            op="workflow_engine.handlers.action.notification.issue_alert.invoke_legacy_registry.activate_downstream_actions"
        ):
            grouped_futures = activate_downstream_actions(rule, job.event, notification_uuid)
            return grouped_futures.values()

    @staticmethod
    def execute_futures(
        job: WorkflowEventData,
        futures: Collection[
            tuple[Callable[[GroupEvent, Sequence[RuleFuture]], None], list[RuleFuture]]
        ],
    ) -> None:
        """
        This method will execute the futures.
        Based off of process_rules in post_process.py
        """
        with sentry_sdk.start_span(
            op="workflow_engine.handlers.action.notification.issue_alert.execute_futures"
        ):
            for callback, future in futures:
                safe_execute(callback, job.event, future)

    @staticmethod
    def send_test_notification(
        job: WorkflowEventData,
        futures: Collection[
            tuple[Callable[[GroupEvent, Sequence[RuleFuture]], None], list[RuleFuture]]
        ],
    ) -> None:
        """
        This method will execute the futures.
        Based off of process_rules in post_process.py
        """
        with sentry_sdk.start_span(
            op="workflow_engine.handlers.action.notification.issue_alert.execute_futures"
        ):
            for callback, future in futures:
                callback(job.event, future)

    @classmethod
    def invoke_legacy_registry(
        cls,
        job: WorkflowEventData,
        action: Action,
        detector: Detector,
    ) -> None:
        """
        This method will create a rule instance from the Action model, and then invoke the legacy registry.
        This method encompases the following logic in our legacy system:
        1. post_process process_rules calls rule_processor.apply
        2. activate_downstream_actions
        3. execute_futures (also in post_process process_rules)
        """

        with sentry_sdk.start_span(
            op="workflow_engine.handlers.action.notification.issue_alert.invoke_legacy_registry"
        ):
            # Create a notification uuid
            notification_uuid = str(uuid.uuid4())

            # Create a rule
            rule = cls.create_rule_instance_from_action(action, detector, job)

            logger.info(
                "notification_action.execute_via_issue_alert_handler",
                extra={
                    "action_id": action.id,
                    "detector_id": detector.id,
                    "job": asdict(job),
                    "rule_id": rule.id,
                    "rule_project_id": rule.project.id,
                    "rule_environment_id": rule.environment_id,
                    "rule_label": rule.label,
                    "rule_data": rule.data,
                },
            )
            # Get the futures
            futures = cls.get_rule_futures(job, rule, notification_uuid)

            # Execute the futures
            # If the rule id is -1, we are sending a test notification
            if rule.id == -1:
                cls.send_test_notification(job, futures)
            else:
                cls.execute_futures(job, futures)


class TicketingIssueAlertHandler(BaseIssueAlertHandler):
    @classmethod
    def get_target_display(cls, action: Action, mapping: ActionFieldMapping) -> dict[str, Any]:
        return {}

    @classmethod
    def get_target_identifier(
        cls, action: Action, mapping: ActionFieldMapping, organization_id: int
    ) -> dict[str, Any]:
        return {}

    @classmethod
    def get_additional_fields(cls, action: Action, mapping: ActionFieldMapping) -> dict[str, Any]:
        # Use helper to separate fields
        dynamic_form_fields = action.data.get(
            TicketFieldMappingKeys.DYNAMIC_FORM_FIELDS_KEY.value, {}
        )
        additional_fields = action.data.get(TicketFieldMappingKeys.ADDITIONAL_FIELDS_KEY.value, {})

        final_blob = {
            TicketFieldMappingKeys.DYNAMIC_FORM_FIELDS_KEY.value: dynamic_form_fields,
            **additional_fields,
        }

        return final_blob


class BaseMetricAlertHandler(ABC):
    @classmethod
    def build_notification_context(cls, action: Action) -> NotificationContext:
        return NotificationContext.from_action_model(action)

    @classmethod
    def build_alert_context(
        cls,
        detector: Detector,
        evidence_data: MetricIssueEvidenceData,
        group_status: GroupStatus,
        priority_level: int | None,
    ) -> AlertContext:
        return AlertContext.from_workflow_engine_models(
            detector, evidence_data, group_status, priority_level
        )

    @classmethod
    def build_metric_issue_context(
        cls, group: Group, evidence_data: MetricIssueEvidenceData, priority_level: int | None
    ) -> MetricIssueContext:
        return MetricIssueContext.from_group_event(group, evidence_data, priority_level)

    @classmethod
    def build_open_period_context(cls, event: GroupEvent) -> OpenPeriodContext:
        return OpenPeriodContext.from_group(event.group)

    @classmethod
    def get_trigger_status(cls, event: GroupEvent) -> TriggerStatus:
        if event.group.status == GroupStatus.RESOLVED or event.group.status == GroupStatus.IGNORED:
            return TriggerStatus.RESOLVED
        return TriggerStatus.ACTIVE

    @classmethod
    def send_alert(
        cls,
        notification_context: NotificationContext,
        alert_context: AlertContext,
        metric_issue_context: MetricIssueContext,
        open_period_context: OpenPeriodContext,
        trigger_status: TriggerStatus,
        notification_uuid: str,
        organization: Organization,
        project: Project,
    ) -> None:
        raise NotImplementedError

    @classmethod
    def invoke_legacy_registry(
        cls,
        job: WorkflowEventData,
        action: Action,
        detector: Detector,
    ) -> None:

        with sentry_sdk.start_span(
            op="workflow_engine.handlers.action.notification.metric_alert.invoke_legacy_registry"
        ):
            event = job.event
            if not event.occurrence:
                raise ValueError("Event occurrence is required for alert context")

            evidence_data = MetricIssueEvidenceData(**event.occurrence.evidence_data)

            notification_context = cls.build_notification_context(action)
            alert_context = cls.build_alert_context(
                detector, evidence_data, event.group.status, event.occurrence.priority
            )

            metric_issue_context = cls.build_metric_issue_context(
                event.group, evidence_data, event.occurrence.priority
            )
            open_period_context = cls.build_open_period_context(event)

            trigger_status = cls.get_trigger_status(event)

            notification_uuid = str(uuid.uuid4())

            logger.info(
                "notification_action.execute_via_metric_alert_handler",
                extra={
                    "action_id": action.id,
                    "detector_id": detector.id,
                    "job": asdict(job),
                    "notification_context": asdict(notification_context),
                    "alert_context": asdict(alert_context),
                    "metric_issue_context": asdict(metric_issue_context),
                    "open_period_context": asdict(open_period_context),
                    "trigger_status": trigger_status,
                },
            )
            cls.send_alert(
                notification_context=notification_context,
                alert_context=alert_context,
                metric_issue_context=metric_issue_context,
                open_period_context=open_period_context,
                trigger_status=trigger_status,
                notification_uuid=notification_uuid,
                organization=detector.project.organization,
                project=detector.project,
            )
