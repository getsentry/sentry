import logging
import uuid
from abc import ABC, abstractmethod
from collections.abc import Callable, Collection, Sequence
from dataclasses import asdict
from typing import Any, NotRequired, Protocol, TypedDict

from django.core.exceptions import ValidationError

from sentry import features
from sentry.constants import ObjectStatus
from sentry.exceptions import InvalidIdentity
from sentry.incidents.grouptype import MetricIssueEvidenceData
from sentry.incidents.models.incident import TriggerStatus
from sentry.incidents.typings.metric_detector import (
    AlertContext,
    MetricIssueContext,
    NotificationContext,
    OpenPeriodContext,
)
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.services.integration.service import integration_service
from sentry.models.activity import Activity
from sentry.models.group import Group, GroupStatus
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.rule import Rule, RuleSource
from sentry.notifications.types import TEST_NOTIFICATION_ID
from sentry.rules.processing.processor import activate_downstream_actions
from sentry.services.eventstore.models import GroupEvent
from sentry.shared_integrations.exceptions import (
    ApiError,
    IntegrationConfigurationError,
    IntegrationFormError,
)
from sentry.taskworker.retry import RetryTaskError
from sentry.taskworker.workerchild import ProcessingDeadlineExceeded
from sentry.types.activity import ActivityType
from sentry.types.rules import RuleFuture
from sentry.workflow_engine.models import Action, AlertRuleWorkflow, Detector
from sentry.workflow_engine.types import ActionInvocation, DetectorPriorityLevel, WorkflowEventData
from sentry.workflow_engine.typings.notification_action import (
    ACTION_FIELD_MAPPINGS,
    ActionFieldMapping,
    ActionFieldMappingKeys,
    TicketFieldMappingKeys,
)

logger = logging.getLogger(__name__)

FutureCallback = Callable[[GroupEvent, Sequence[RuleFuture]], Any]


class RuleData(TypedDict):
    actions: list[dict[str, Any]]
    legacy_rule_id: NotRequired[int]


class LegacyRegistryHandler(ABC):
    """
    Abstract base class that defines the interface for notification handlers.
    """

    @staticmethod
    @abstractmethod
    def handle_workflow_action(invocation: ActionInvocation) -> None:
        """
        Implement this method to handle the specific notification logic for your handler.
        """
        raise NotImplementedError


EXCEPTION_IGNORE_LIST = (IntegrationFormError, IntegrationConfigurationError, InvalidIdentity)
RETRYABLE_EXCEPTIONS = (ApiError,)


def invoke_future_with_error_handling(
    event_data: WorkflowEventData,
    callback: FutureCallback,
    future: Sequence[RuleFuture],
) -> None:
    # WorkflowEventData should only ever be a GroupEvent in this context, so we
    # narrow the type here to keep mypy happy.
    assert isinstance(
        event_data.event, GroupEvent
    ), f"Expected a GroupEvent, received: {type(event_data.event).__name__}"
    try:
        callback(event_data.event, future)
    except EXCEPTION_IGNORE_LIST:
        # no-op on any exceptions in the ignore list. We likely have
        # reporting for them in the integration code already.
        pass
    except ProcessingDeadlineExceeded:
        # We need to reraise ProcessingDeadlineExceeded for workflow engine to
        # monitor and potentially retry this action.
        raise
    except RETRYABLE_EXCEPTIONS as e:
        raise RetryTaskError from e
    except Exception as e:
        # This is just a redefinition of the safe_execute util function, as we
        # still want to report any unhandled exceptions.
        if hasattr(callback, "im_class"):
            cls = callback.im_class
        else:
            cls = callback.__class__

        func_name = getattr(callback, "__name__", str(callback))
        cls_name = cls.__name__
        local_logger = logging.getLogger(f"sentry.safe_action.{cls_name.lower()}")

        local_logger.exception("%s.process_error", func_name, extra={"exception": e})
        return None


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
        event_data: WorkflowEventData,
    ) -> Rule:
        """
        Creates a Rule instance from the Action model.
        :param action: Action
        :param detector: Detector
        :param event_data: WorkflowEventData
        :return: Rule instance
        """
        environment_id = event_data.workflow_env.id if event_data.workflow_env else None

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
            if workflow_id == TEST_NOTIFICATION_ID:
                data["actions"][0]["legacy_rule_id"] = TEST_NOTIFICATION_ID

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

        if workflow_id == TEST_NOTIFICATION_ID and action.type == Action.Type.EMAIL:
            # mail action needs to have skipDigests set to True
            data["actions"][0]["skipDigests"] = True

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
        event_data: WorkflowEventData,
        rule: Rule,
        notification_uuid: str,
    ) -> Collection[tuple[Callable[[GroupEvent, Sequence[RuleFuture]], None], list[RuleFuture]]]:
        """
        This method will collect the futures from the activate_downstream_actions method.
        Based off of rule_processor.apply in rules/processing/processor.py
        """
        if not isinstance(event_data.event, GroupEvent):
            raise ValueError(
                f"WorkflowEventData.event expected GroupEvent, but received: {type(event_data.event).__name__}"
            )

        grouped_futures = activate_downstream_actions(rule, event_data.event, notification_uuid)
        return grouped_futures.values()

    @staticmethod
    def execute_futures(
        event_data: WorkflowEventData,
        futures: Collection[tuple[FutureCallback, list[RuleFuture]]],
    ) -> None:
        """
        This method will execute the futures.
        Based off of process_rules in post_process.py
        """
        if not isinstance(event_data.event, GroupEvent):
            raise ValueError(
                "WorkflowEventData.event is not a GroupEvent when evaluating issue alerts"
            )

        for callback, future in futures:
            invoke_future_with_error_handling(event_data, callback, future)

    @staticmethod
    def send_test_notification(
        event_data: WorkflowEventData,
        futures: Collection[
            tuple[Callable[[GroupEvent, Sequence[RuleFuture]], None], list[RuleFuture]]
        ],
    ) -> None:
        """
        This method will execute the futures.
        Based off of process_rules in post_process.py
        """
        if not isinstance(event_data.event, GroupEvent):
            raise ValueError(
                "WorkflowEventData.event is not a GroupEvent when sending test notification"
            )

        for callback, future in futures:
            callback(event_data.event, future)

    @classmethod
    def invoke_legacy_registry(cls, invocation: ActionInvocation) -> None:
        """
        This method will create a rule instance from the Action model, and then invoke the legacy registry.
        This method encompasses the following logic in our legacy system:
        1. post_process process_rules calls rule_processor.apply
        2. activate_downstream_actions
        3. execute_futures (also in post_process process_rules)
        """
        # Create a notification uuid
        notification_uuid = str(uuid.uuid4())

        # Create a rule
        rule = cls.create_rule_instance_from_action(
            invocation.action, invocation.detector, invocation.event_data
        )

        logger.info(
            "notification_action.execute_via_issue_alert_handler",
            extra={
                "action_id": invocation.action.id,
                "detector_id": invocation.detector.id,
                "event_data": asdict(invocation.event_data),
                "rule_id": rule.id,
                "rule_project_id": rule.project.id,
                "rule_environment_id": rule.environment_id,
                "rule_label": rule.label,
                "rule_data": rule.data,
            },
        )
        # Get the futures
        futures = cls.get_rule_futures(invocation.event_data, rule, notification_uuid)

        # Execute the futures
        # If the rule id is -1, we are sending a test notification
        if rule.id == TEST_NOTIFICATION_ID:
            cls.send_test_notification(invocation.event_data, futures)
        else:
            cls.execute_futures(invocation.event_data, futures)


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
    ACTIVITIES_TO_INVOKE_ON = [ActivityType.SET_RESOLVED.value]

    @classmethod
    def build_notification_context(cls, action: Action) -> NotificationContext:
        return NotificationContext.from_action_model(action)

    @classmethod
    def build_alert_context(
        cls,
        detector: Detector,
        evidence_data: MetricIssueEvidenceData,
        group_status: GroupStatus,
        detector_priority_level: DetectorPriorityLevel,
    ) -> AlertContext:
        return AlertContext.from_workflow_engine_models(
            detector, evidence_data, group_status, detector_priority_level
        )

    @classmethod
    def build_metric_issue_context(
        cls,
        group: Group,
        evidence_data: MetricIssueEvidenceData,
        detector_priority_level: DetectorPriorityLevel,
    ) -> MetricIssueContext:
        return MetricIssueContext.from_group_event(group, evidence_data, detector_priority_level)

    @classmethod
    def build_open_period_context(cls, group: Group) -> OpenPeriodContext:
        return OpenPeriodContext.from_group(group)

    @classmethod
    def get_trigger_status(cls, group: Group) -> TriggerStatus:
        if group.status == GroupStatus.RESOLVED or group.status == GroupStatus.IGNORED:
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

    @staticmethod
    def _extract_from_group_event(
        event: GroupEvent,
    ) -> tuple[MetricIssueEvidenceData, DetectorPriorityLevel]:
        """
        Extract evidence data and priority from a GroupEvent
        """

        if event.occurrence is None:
            raise ValueError("Event occurrence is required for alert context")

        if event.occurrence.priority is None:
            raise ValueError("Event occurrence priority is required for alert context")

        evidence_data = MetricIssueEvidenceData(**event.occurrence.evidence_data)
        priority = DetectorPriorityLevel(event.occurrence.priority)
        return evidence_data, priority

    @staticmethod
    def _extract_from_activity(
        event: Activity,
    ) -> tuple[MetricIssueEvidenceData, DetectorPriorityLevel]:
        """
        Extract evidence data and priority from an Activity event
        """

        if event.type != ActivityType.SET_RESOLVED.value:
            raise ValueError(
                "Activity type must be SET_RESOLVED to invoke metric alert legacy registry"
            )

        if event.data is None or not event.data:
            raise ValueError("Activity data is required for alert context")

        evidence_data_dict = dict(event.data)
        priority = DetectorPriorityLevel.OK
        evidence_data = MetricIssueEvidenceData(**evidence_data_dict)

        return evidence_data, priority

    @classmethod
    def invoke_legacy_registry(cls, invocation: ActionInvocation) -> None:

        event = invocation.event_data.event

        # Extract evidence data and priority based on event type
        if isinstance(event, GroupEvent):
            evidence_data, priority = cls._extract_from_group_event(event)
        elif isinstance(event, Activity):
            evidence_data, priority = cls._extract_from_activity(event)
        else:
            raise ValueError(
                "WorkflowEventData.event must be a GroupEvent or Activity to invoke metric alert legacy registry"
            )

        notification_context = cls.build_notification_context(invocation.action)
        alert_context = cls.build_alert_context(
            invocation.detector, evidence_data, invocation.event_data.group.status, priority
        )

        metric_issue_context = cls.build_metric_issue_context(
            invocation.event_data.group, evidence_data, priority
        )
        open_period_context = cls.build_open_period_context(invocation.event_data.group)

        trigger_status = cls.get_trigger_status(invocation.event_data.group)

        notification_uuid = str(uuid.uuid4())

        logger.info(
            "notification_action.execute_via_metric_alert_handler",
            extra={
                "action_id": invocation.action.id,
                "detector_id": invocation.detector.id,
                "event_data": asdict(invocation.event_data),
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
            organization=invocation.detector.project.organization,
            project=invocation.detector.project,
        )


class NotificationActionForm(Protocol):
    """Protocol for notification action forms since they have various inheritance layers and but all have the same __init__ signature"""

    def __init__(self, *args: Any, **kwargs: Any) -> None: ...

    def is_valid(self) -> bool: ...

    @property
    def cleaned_data(self) -> dict[str, Any]: ...

    @property
    def errors(self) -> dict[str, Any]: ...


def _get_integrations(organization: Organization, provider: str) -> list[RpcIntegration]:
    return integration_service.get_integrations(
        organization_id=organization.id,
        status=ObjectStatus.ACTIVE,
        org_integration_status=ObjectStatus.ACTIVE,
        providers=[provider],
    )


class BaseActionValidatorProtocol(Protocol):
    def __init__(self, validated_data: dict[str, Any], organization: Organization) -> None: ...

    def clean_data(self) -> dict[str, Any]: ...


class BaseActionValidatorHandler(ABC):
    provider: str
    notify_action_form: type[NotificationActionForm] | None

    def __init__(self, validated_data: dict[str, Any], organization: Organization) -> None:
        self.validated_data = validated_data
        self.organization = organization

    def generate_action_form_payload(self) -> dict[str, Any]:
        return {
            "data": self.generate_action_form_data(),
            "integrations": _get_integrations(self.organization, self.provider),
        }

    def clean_data(self) -> dict[str, Any]:
        if self.notify_action_form is None:
            return self.validated_data

        notify_action_form = self.notify_action_form(
            **self.generate_action_form_payload(),
        )

        if notify_action_form.is_valid():
            return self.update_action_data(notify_action_form.cleaned_data)

        raise ValidationError(notify_action_form.errors)

    @abstractmethod
    def generate_action_form_data(self) -> dict[str, Any]:
        # translate validated data from BaseActionValidator to notify action form data
        pass

    @abstractmethod
    def update_action_data(self, cleaned_data: dict[str, Any]) -> dict[str, Any]:
        # update BaseActionValidator data with cleaned notify action form data
        pass
