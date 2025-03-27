import logging

from sentry.notifications.notification_action import group_type_notification_registry
from sentry.notifications.notification_action.group_type_notification_registry.issue_alert_registry_handler import (
    IssueAlertRegistryHandler,
)
from sentry.utils.registry import NoRegistrationExistsError
from sentry.workflow_engine.models import Action, Detector
from sentry.workflow_engine.types import WorkflowEventData

logger = logging.getLogger(__name__)


def execute_via_group_type_registry(
    job: WorkflowEventData, action: Action, detector: Detector
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


def execute_via_issue_alert_handler(
    job: WorkflowEventData, action: Action, detector: Detector
) -> None:
    """
    This exists so that all ticketing actions can use the same handler as issue alerts since that's the only way we can
    ensure that the same thread is used for the notification action.
    """
    IssueAlertRegistryHandler.handle_workflow_action(job, action, detector)
