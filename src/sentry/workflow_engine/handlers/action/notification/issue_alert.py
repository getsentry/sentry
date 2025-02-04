import logging
import uuid
from abc import ABC, abstractmethod

import sentry_sdk

from sentry.constants import ObjectStatus
from sentry.models.rule import Rule, RuleSource
from sentry.rules.actions.base import instantiate_action
from sentry.types.rules import RuleFuture
from sentry.utils.registry import Registry
from sentry.utils.safe import safe_execute
from sentry.workflow_engine.models import Action, Detector
from sentry.workflow_engine.types import WorkflowJob
from sentry.workflow_engine.typings.notification_action import DiscordDataBlob

logger = logging.getLogger(__name__)


class BaseIssueAlertHandler(ABC):
    """
    Base class for invoking the legacy issue alert registry.
    """

    @abstractmethod
    def build_rule_action_blob(
        self,
        action: Action,
    ) -> dict:
        """
        Build the rule action blob from the Action model.
        """
        raise NotImplementedError

    def create_rule_instance_from_action(
        self,
        action: Action,
        detector: Detector,
    ) -> Rule:
        """
        Creates a Rule instance from the Action model.
        :param action: Action
        :param detector: Detector
        :return: Rule instance
        """

        rule = Rule(
            id=detector.id,
            project=detector.project,
            label=detector.name,
            data={"actions": [self.build_rule_action_blob(action)]},
            status=ObjectStatus.ACTIVE,
            source=RuleSource.ISSUE,
        )

        return rule

    def invoke_legacy_registry(
        self,
        job: WorkflowJob,
        action: Action,
        detector: Detector,
    ) -> None:
        """
        This method will create a rule instance from the Action model, and then invoke the legacy registry.
        """

        with sentry_sdk.start_span(
            op="workflow_engine.handlers.action.notification.issue_alert.invoke_legacy_registry"
        ):
            # Create a notification uuid
            notification_uuid = str(uuid.uuid4())

            # Create a rule
            rule = self.create_rule_instance_from_action(action, detector)

        with sentry_sdk.start_span(
            op="workflow_engine.handlers.action.notification.issue_alert.invoke_legacy_registry.instantiate_action"
        ):
            # This should only have one action
            action_data = rule.data.get("actions", [])
            assert len(action_data) == 1

            action_inst = instantiate_action(rule, action_data)
            if not action_inst:
                logger.error(
                    "Failed to instantiate action",
                    extra={"detector_id": detector.id, "action_id": action.id},
                )
                raise ValueError(
                    f"Failed to instantiate action {action.id} for detector {detector.id}"
                )

        with sentry_sdk.start_span(
            op="workflow_engine.handlers.action.notification.issue_alert.invoke_legacy_registry.instantiate_action.safe_execute"
        ):
            results = safe_execute(
                action_inst.after,
                event=job["event"],
                notification_uuid=notification_uuid,
            )
        if results is None:
            raise ValueError("Action %s did not return any futures", action.id)

        for future in results:
            rule_future = RuleFuture(rule=rule, kwargs=future.kwargs)
            # Send the notification
            safe_execute(future.callback, job["event"], [rule_future])


issue_alert_handler_registry = Registry[BaseIssueAlertHandler]()


@issue_alert_handler_registry.register(Action.Type.DISCORD)
class DiscordIssueAlertHandler(BaseIssueAlertHandler):
    def build_rule_action_blob(self, action: Action) -> dict:
        blob = DiscordDataBlob(**action.data)
        return {
            "id": "sentry.integrations.discord.notify_action.DiscordNotifyServiceAction",
            "server": action.integration_id,
            "channel_id": action.target_identifier,
            "tags": blob.tags,
        }
