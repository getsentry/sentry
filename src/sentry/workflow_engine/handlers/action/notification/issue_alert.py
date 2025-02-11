import logging
import uuid
from abc import ABC, abstractmethod
from collections.abc import Callable, Collection, Sequence
from typing import Any

import sentry_sdk

from sentry.constants import ObjectStatus
from sentry.eventstore.models import GroupEvent
from sentry.models.rule import Rule, RuleSource
from sentry.rules.processing.processor import activate_downstream_actions
from sentry.types.rules import RuleFuture
from sentry.utils.registry import Registry
from sentry.utils.safe import safe_execute
from sentry.workflow_engine.models import Action, Detector
from sentry.workflow_engine.types import WorkflowJob
from sentry.workflow_engine.typings.notification_action import (
    ACTION_FIELD_MAPPINGS,
    ActionFieldMapping,
    ActionFieldMappingKeys,
    DiscordDataBlob,
)

logger = logging.getLogger(__name__)


class BaseIssueAlertHandler(ABC):
    """
    Base class for invoking the legacy issue alert registry.
    """

    @staticmethod
    def get_integration_id(action: Action, mapping: ActionFieldMapping) -> dict[str, Any]:
        if mapping.get(ActionFieldMappingKeys.INTEGRATION_ID_KEY.value):
            return {mapping[ActionFieldMappingKeys.INTEGRATION_ID_KEY.value]: action.integration_id}
        raise ValueError(f"No integration id key found for action type: {action.type}")

    @classmethod
    def get_target_identifier(cls, action: Action, mapping: ActionFieldMapping) -> dict[str, Any]:
        if mapping.get(ActionFieldMappingKeys.TARGET_IDENTIFIER_KEY.value):
            return {
                mapping[
                    ActionFieldMappingKeys.TARGET_IDENTIFIER_KEY.value
                ]: action.target_identifier
            }
        raise ValueError(f"No target identifier key found for action type: {action.type}")

    @classmethod
    def get_target_display(cls, action: Action, mapping: ActionFieldMapping) -> dict[str, Any]:
        if mapping.get(ActionFieldMappingKeys.TARGET_DISPLAY_KEY.value):
            return {mapping[ActionFieldMappingKeys.TARGET_DISPLAY_KEY.value]: action.target_display}
        raise ValueError(f"No target display key found for action type: {action.type}")

    @classmethod
    @abstractmethod
    def get_additional_fields(cls, action: Action, mapping: ActionFieldMapping) -> dict[str, Any]:
        """Add additional fields to the blob"""
        raise NotImplementedError(
            f"get_additional_fields not implemented for action type: {action.type}"
        )

    @classmethod
    def build_rule_action_blob(
        cls,
        action: Action,
    ) -> dict[str, Any]:
        """Build the base action blob using the standard mapping"""
        mapping = ACTION_FIELD_MAPPINGS.get(Action.Type(action.type))
        if mapping is None:
            raise ValueError(f"No mapping found for action type: {action.type}")
        blob: dict[str, Any] = {
            "id": mapping["id"],
        }
        blob.update(cls.get_integration_id(action, mapping))
        blob.update(cls.get_target_identifier(action, mapping))
        blob.update(cls.get_target_display(action, mapping))
        blob.update(cls.get_additional_fields(action, mapping))
        return blob

    @classmethod
    def create_rule_instance_from_action(
        cls,
        action: Action,
        detector: Detector,
        job: WorkflowJob,
    ) -> Rule:
        """
        Creates a Rule instance from the Action model.
        :param action: Action
        :param detector: Detector
        :param job: WorkflowJob
        :return: Rule instance
        """
        workflow = job.get("workflow")
        environment_id = None
        if workflow and workflow.environment:
            environment_id = workflow.environment.id

        rule = Rule(
            id=action.id,
            project=detector.project,
            environment_id=environment_id,
            label=detector.name,
            data={"actions": [cls.build_rule_action_blob(action)]},
            status=ObjectStatus.ACTIVE,
            source=RuleSource.ISSUE,
        )

        return rule

    @staticmethod
    def get_rule_futures(
        job: WorkflowJob,
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
            grouped_futures = activate_downstream_actions(rule, job["event"], notification_uuid)
            return grouped_futures.values()

    @staticmethod
    def execute_futures(
        job: WorkflowJob,
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
            for callback, futures in futures:
                safe_execute(callback, job["event"], futures)

    @classmethod
    def invoke_legacy_registry(
        cls,
        job: WorkflowJob,
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

            # Get the futures
            futures = cls.get_rule_futures(job, rule, notification_uuid)

            # Execute the futures
            cls.execute_futures(job, futures)


issue_alert_handler_registry = Registry[BaseIssueAlertHandler]()


@issue_alert_handler_registry.register(Action.Type.DISCORD)
class DiscordIssueAlertHandler(BaseIssueAlertHandler):
    @classmethod
    def get_additional_fields(cls, action: Action, mapping: ActionFieldMapping) -> dict[str, Any]:
        blob = DiscordDataBlob(**action.data)
        return {"tags": blob.tags}

    @classmethod
    def get_target_display(cls, action: Action, mapping: ActionFieldMapping) -> dict[str, Any]:
        return {}
