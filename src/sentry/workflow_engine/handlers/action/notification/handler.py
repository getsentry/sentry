import logging
from abc import ABC, abstractmethod

from sentry.grouping.grouptype import ErrorGroupType
from sentry.issues.grouptype import MetricIssuePOC
from sentry.models.team import Team
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.users.services.user import RpcUser
from sentry.users.services.user.service import user_service
from sentry.utils.registry import NoRegistrationExistsError, Registry
from sentry.workflow_engine.handlers.action.notification.issue_alert import (
    issue_alert_handler_registry,
)
from sentry.workflow_engine.handlers.action.notification.metric_alert import (
    metric_alert_handler_registry,
)
from sentry.workflow_engine.models import Action, Detector
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import ActionHandler, WorkflowJob

logger = logging.getLogger(__name__)


class NotificationHandlerException(Exception):
    pass


class LegacyRegistryInvoker(ABC):
    """
    Abstract base class that defines the interface for notification handlers.
    """

    @staticmethod
    @abstractmethod
    def handle_workflow_action(job: WorkflowJob, action: Action, detector: Detector) -> None:
        """
        Implement this method to handle the specific notification logic for your handler.
        """
        raise NotImplementedError


group_type_notification_registry = Registry[LegacyRegistryInvoker]()


@action_handler_registry.register(Action.Type.DISCORD)
@action_handler_registry.register(Action.Type.SLACK)
@action_handler_registry.register(Action.Type.MSTEAMS)
@action_handler_registry.register(Action.Type.PAGERDUTY)
@action_handler_registry.register(Action.Type.OPSGENIE)
@action_handler_registry.register(Action.Type.GITHUB)
@action_handler_registry.register(Action.Type.GITHUB_ENTERPRISE)
@action_handler_registry.register(Action.Type.JIRA)
@action_handler_registry.register(Action.Type.JIRA_SERVER)
@action_handler_registry.register(Action.Type.AZURE_DEVOPS)
@action_handler_registry.register(Action.Type.EMAIL)
@action_handler_registry.register(Action.Type.SENTRY_APP)
@action_handler_registry.register(Action.Type.WEBHOOK)
@action_handler_registry.register(Action.Type.PLUGIN)
class NotificationActionHandler(ActionHandler):
    config_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "description": "The configuration schema for a Notification Action",
        "type": "object",
        "properties": {
            "target_identifier": {
                "type": ["string", "null"],
            },
            "target_display": {
                "type": ["string", "null"],
            },
            "target_type": {
                "type": ["integer", "null"],
                "enum": [*ActionTarget] + [None],
            },
        },
    }

    @staticmethod
    def execute(
        job: WorkflowJob,
        action: Action,
        detector: Detector,
    ) -> None:
        try:
            handler = group_type_notification_registry.get(detector.type)
            handler.handle_workflow_action(job, action, detector)
        except NoRegistrationExistsError:
            logger.exception(
                "No notification handler found for detector type: %s",
                detector.type,
                extra={"detector_id": detector.id, "action_id": action.id},
            )


@group_type_notification_registry.register(ErrorGroupType.slug)
class IssueAlertRegistryInvoker(LegacyRegistryInvoker):
    @staticmethod
    def handle_workflow_action(job: WorkflowJob, action: Action, detector: Detector) -> None:
        try:
            handler = issue_alert_handler_registry.get(action.type)
            handler.invoke_legacy_registry(job, action, detector)
        except NoRegistrationExistsError:
            logger.exception(
                "No issue alert handler found for action type: %s",
                action.type,
                extra={"action_id": action.id},
            )
            raise
        except Exception as e:
            logger.exception(
                "Error invoking issue alert handler",
                extra={"action_id": action.id},
            )
            raise NotificationHandlerException(e)


@group_type_notification_registry.register(MetricIssuePOC.slug)
class MetricAlertRegistryInvoker(LegacyRegistryInvoker):
    @staticmethod
    def handle_workflow_action(job: WorkflowJob, action: Action, detector: Detector) -> None:
        try:
            handler = metric_alert_handler_registry.get(action.type)
            handler.invoke_legacy_registry(job, action, detector)
        except NoRegistrationExistsError:
            logger.exception(
                "No metric alert handler found for action type: %s",
                action.type,
                extra={"action_id": action.id},
            )
            raise
        except Exception as e:
            logger.exception(
                "Error invoking metric alert handler",
                extra={"action_id": action.id},
            )
            raise NotificationHandlerException(e)

    @staticmethod
    def target(action: Action) -> RpcUser | Team | str | None:
        target_identifier = action.config.get("target_identifier")
        if target_identifier is None:
            return None

        target_type = action.config.get("target_type")
        if target_type == ActionTarget.USER.value:
            return user_service.get_user(user_id=int(target_identifier))
        elif target_type == ActionTarget.TEAM.value:
            try:
                return Team.objects.get(id=int(target_identifier))
            except Team.DoesNotExist:
                pass
        elif target_type == ActionTarget.SPECIFIC.value:
            # TODO: This is only for email. We should have a way of validating that it's
            # ok to contact this email.
            return target_identifier
        return None
