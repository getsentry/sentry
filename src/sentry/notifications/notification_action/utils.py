import logging

from sentry.models.activity import Activity
from sentry.notifications.notification_action.registry import (
    group_type_notification_registry,
    issue_alert_handler_registry,
)
from sentry.utils.registry import NoRegistrationExistsError
from sentry.workflow_engine.models import Action, Detector
from sentry.workflow_engine.types import WorkflowEventData

logger = logging.getLogger(__name__)


def execute_via_group_type_registry(
    event_data: WorkflowEventData, action: Action, detector: Detector
) -> None:
    """
    Generic "notification action handler" this method will lookup which registry
    to send the notification to, based on the type of detector that created it.

    This currently only supports the following detector types: 'error', 'metric_issue'

    If an `Activity` model for a `Group` is provided in the event data
    it will send an activity notification instead.
    """
    if isinstance(event_data.event, Activity):
        # TODO - this is a workaround to ensure a notification is sent about the issue.
        # We'll need to update this in the future to read the notification configuration
        # from the Action, then get the template for the activity, and send it to that
        # integration.
        return event_data.event.send_notification()

    try:
        handler = group_type_notification_registry.get(detector.type)
        handler.handle_workflow_action(event_data, action, detector)
    except NoRegistrationExistsError:
        logger.exception(
            "No notification handler found for detector type: %s",
            detector.type,
            extra={"detector_id": detector.id, "action_id": action.id},
        )
        raise
    except Exception:
        logger.exception(
            "Error executing via group type registry",
            extra={"detector_id": detector.id, "action_id": action.id},
        )
        raise


def execute_via_issue_alert_handler(
    job: WorkflowEventData, action: Action, detector: Detector
) -> None:
    """
    This exists so that all ticketing actions can use the same handler as issue alerts since that's the only way we can
    ensure that the same thread is used for the notification action.
    """
    try:
        handler = issue_alert_handler_registry.get(action.type)
        handler.invoke_legacy_registry(job, action, detector)
    except NoRegistrationExistsError:
        logger.exception(
            "No notification handler found for action type: %s",
            action.type,
            extra={"action_id": action.id, "detector_id": detector.id},
        )
        raise
    except Exception:
        logger.exception(
            "Error executing via issue alert handler",
            extra={"action_id": action.id, "detector_id": detector.id},
        )
        raise
