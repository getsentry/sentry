import logging

import sentry_sdk

from sentry import features
from sentry.incidents.charts import build_metric_alert_chart
from sentry.incidents.grouptype import MetricIssue
from sentry.integrations.metric_alerts import incident_attachment_info
from sentry.models.activity import Activity
from sentry.models.organization import Organization
from sentry.notifications.notification_action.registry import (
    group_type_notification_registry,
    issue_alert_handler_registry,
    metric_alert_handler_registry,
)
from sentry.notifications.notification_action.types import BaseMetricAlertHandler
from sentry.notifications.platform.templates.issue import (
    IssueNotificationData,
    SerializableRuleProxy,
)
from sentry.notifications.platform.templates.metric_alert import MetricAlertNotificationData
from sentry.notifications.utils.issue_notification_context import IssueNotificationContext
from sentry.utils.registry import NoRegistrationExistsError
from sentry.workflow_engine.types import ActionInvocation

logger = logging.getLogger(__name__)


def should_fire_workflow_actions(org: Organization, type_id: int) -> bool:
    return True


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


def issue_notification_data_factory(invocation: ActionInvocation) -> IssueNotificationData:
    action = invocation.action
    detector = invocation.detector
    event_data = invocation.event_data

    handler = issue_alert_handler_registry.get(action.type)
    rule_instance = handler.create_rule_instance_from_action(
        action=action,
        detector=detector,
        event_data=event_data,
    )
    tags = action.data.get("tags", None)
    tag_list = [tag.strip() for tag in tags.split(",")] if tags else None
    notes = action.data.get("notes", None)
    rule = SerializableRuleProxy.from_rule(rule_instance)

    event_id = getattr(event_data.event, "event_id", None) if event_data.event else None

    return IssueNotificationData(
        tags=tag_list,
        notes=notes,
        event_id=event_id,
        group_id=event_data.group.id,
        notification_uuid=invocation.notification_uuid,
        rule=rule,
    )


def metric_alert_notification_data_factory(
    issue_notif_context: IssueNotificationContext,
) -> MetricAlertNotificationData:
    from sentry.notifications.notification_action.metric_alert_registry.handlers.utils import (
        get_alert_rule_serializer,
        get_detailed_incident_serializer,
        get_detector_serializer,
    )

    notification_context = issue_notif_context.notification_context
    alert_context = issue_notif_context.alert_context
    metric_issue_context = issue_notif_context.metric_issue_context
    open_period_context = issue_notif_context.open_period_context
    organization = issue_notif_context.organization

    if notification_context.integration_id is None:
        raise ValueError("Integration ID is None")

    if notification_context.target_identifier is None:
        raise ValueError("Slack channel is None")

    referrer = f"metric_alert_{issue_notif_context.action_type}"
    attachment_info = incident_attachment_info(
        organization=organization,
        alert_context=alert_context,
        metric_issue_context=metric_issue_context,
        notification_uuid=issue_notif_context.notification_uuid,
        referrer=referrer,
    )

    alert_rule_serialized_response = get_alert_rule_serializer(issue_notif_context.detector)
    detector_serialized_response = get_detector_serializer(issue_notif_context.detector)
    incident_serialized_response = get_detailed_incident_serializer(issue_notif_context.open_period)

    chart_url = None
    if (
        features.has("organizations:metric-alert-chartcuterie", organization)
        and alert_rule_serialized_response
        and incident_serialized_response
    ):
        try:
            chart_url = build_metric_alert_chart(
                organization=organization,
                alert_rule_serialized_response=alert_rule_serialized_response,
                snuba_query=metric_issue_context.snuba_query,
                alert_context=alert_context,
                open_period_context=open_period_context,
                selected_incident_serialized=incident_serialized_response,
                subscription=metric_issue_context.subscription,
                detector_serialized_response=detector_serialized_response,
            )
        except Exception as e:
            sentry_sdk.capture_exception(e)

    return MetricAlertNotificationData(
        group_id=metric_issue_context.id,
        organization_id=organization.id,
        notification_uuid=issue_notif_context.notification_uuid,
        action_id=notification_context.id,
        open_period_context=open_period_context,
        new_status=metric_issue_context.new_status.value,
        title=attachment_info["title"],
        title_link=attachment_info["title_link"],
        text=attachment_info["text"],
        chart_url=chart_url,
    )
