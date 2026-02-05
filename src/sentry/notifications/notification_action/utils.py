import logging

from sentry import features, options
from sentry.incidents.grouptype import MetricIssue
from sentry.models.activity import Activity
from sentry.models.organization import Organization
from sentry.notifications.notification_action.registry import (
    group_type_notification_registry,
    issue_alert_handler_registry,
    metric_alert_handler_registry,
)
from sentry.notifications.notification_action.types import BaseMetricAlertHandler
from sentry.utils.registry import NoRegistrationExistsError
from sentry.workflow_engine.types import ActionInvocation

logger = logging.getLogger(__name__)


def should_fire_workflow_actions(org: Organization, type_id: int) -> bool:
    ga_type_ids = options.get("workflow_engine.issue_alert.group.type_id.ga")
    rollout_type_ids = options.get("workflow_engine.issue_alert.group.type_id.rollout")

    return (
        type_id in ga_type_ids  # We have completely rolled out these group types
        or (
            type_id
            in rollout_type_ids  # While we are rolling out these groups & we are single  processing
            and features.has("organizations:workflow-engine-single-process-workflows", org)
        )
        or (type_id == MetricIssue.type_id)
    )


def execute_via_group_type_registry(invocation: ActionInvocation) -> None:
    """
    Generic "notification action handler" this method will lookup which registry
    to send the notification to, based on the type of detector that created it.

    This currently only supports the following detector types: 'error', 'metric_issue'

    If an `Activity` model for a `Group` is provided in the event data
    it will send an activity notification instead.
    """
    if isinstance(invocation.event_data.event, Activity):
        # TODO - this is a workaround to ensure a notification is sent about the issue.
        # We'll need to update this in the future to read the notification configuration
        # from the Action, then get the template for the activity, and send it to that
        # integration.
        # If it is a metric issue resolution, we need to execute the metric alert handler
        # Else we can use the activity.send_notification() method to send the notification.
        if (
            invocation.event_data.event.type in BaseMetricAlertHandler.ACTIVITIES_TO_INVOKE_ON
            and invocation.event_data.group.type == MetricIssue.type_id
        ):
            return execute_via_metric_alert_handler(invocation)
        return invocation.event_data.event.send_notification()

    try:
        handler = group_type_notification_registry.get(invocation.detector.type)
        handler.handle_workflow_action(invocation)
    except NoRegistrationExistsError:
        # If the grouptype is not registered, we can just use the issue alert handler
        # This is so that notifications will still be sent for that group type if we forget to register a handler
        # Most grouptypes are sent to issue alert handlers
        logger.warning(
            "group_type_notification_registry.get.NoRegistrationExistsError",
            extra={"detector_id": invocation.detector.id, "action_id": invocation.action.id},
        )
        return execute_via_issue_alert_handler(invocation)
    except Exception:
        logger.exception(
            "Error executing via group type registry",
            extra={"detector_id": invocation.detector.id, "action_id": invocation.action.id},
        )
        raise


def execute_via_issue_alert_handler(invocation: ActionInvocation) -> None:
    """
    This exists so that all ticketing actions can use the same handler as issue alerts since that's the only way we can
    ensure that the same thread is used for the notification action.
    """
    try:
        handler = issue_alert_handler_registry.get(invocation.action.type)
        handler.invoke_legacy_registry(invocation)
    except NoRegistrationExistsError:
        logger.exception(
            "No notification handler found for action type: %s",
            invocation.action.type,
            extra={"action_id": invocation.action.id, "detector_id": invocation.detector.id},
        )
        raise
    except Exception:
        logger.exception(
            "Error executing via issue alert handler",
            extra={"action_id": invocation.action.id, "detector_id": invocation.detector.id},
        )
        raise


def execute_via_metric_alert_handler(invocation: ActionInvocation) -> None:
    """
    This exists so that all metric alert resolution actions can use the same handler as metric alerts
    """
    try:
        handler = metric_alert_handler_registry.get(invocation.action.type)
        handler.invoke_legacy_registry(invocation)
    except NoRegistrationExistsError:
        logger.exception(
            "No notification handler found for action type: %s",
            invocation.action.type,
            extra={"action_id": invocation.action.id, "detector_id": invocation.detector.id},
        )
        raise
    except Exception:
        logger.exception(
            "Error executing via metric alert handler in legacy registry",
            extra={"action_id": invocation.action.id, "detector_id": invocation.detector.id},
        )
        raise
