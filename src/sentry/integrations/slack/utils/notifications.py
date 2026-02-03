from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime

import orjson
import sentry_sdk
from slack_sdk.errors import SlackApiError, SlackRequestError
from slack_sdk.webhook import WebhookClient

from sentry import features
from sentry.constants import METRIC_ALERTS_THREAD_DEFAULT, ObjectStatus
from sentry.incidents.charts import build_metric_alert_chart
from sentry.incidents.endpoints.serializers.alert_rule import AlertRuleSerializerResponse
from sentry.incidents.endpoints.serializers.incident import DetailedIncidentSerializerResponse
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.incident import IncidentStatus
from sentry.incidents.typings.metric_detector import (
    AlertContext,
    MetricIssueContext,
    NotificationContext,
    OpenPeriodContext,
)
from sentry.integrations.messaging.metrics import (
    MessagingInteractionEvent,
    MessagingInteractionType,
)
from sentry.integrations.models.integration import Integration
from sentry.integrations.repository import (
    get_default_metric_alert_repository,
    get_default_notification_action_repository,
)
from sentry.integrations.repository.base import BaseNewNotificationMessage
from sentry.integrations.repository.metric_alert import (
    MetricAlertNotificationMessage,
    MetricAlertNotificationMessageRepository,
    NewMetricAlertNotificationMessage,
)
from sentry.integrations.repository.notification_action import (
    NewNotificationActionNotificationMessage,
    NotificationActionNotificationMessage,
    NotificationActionNotificationMessageRepository,
)
from sentry.integrations.services.integration import RpcIntegration, integration_service
from sentry.integrations.slack.message_builder.incidents import SlackIncidentsMessageBuilder
from sentry.integrations.slack.message_builder.types import SlackBlock
from sentry.integrations.slack.metrics import record_lifecycle_termination_level
from sentry.integrations.slack.sdk_client import SlackSdkClient
from sentry.integrations.slack.spec import SlackMessagingSpec
from sentry.integrations.slack.utils.threads import NotificationActionThreadUtils
from sentry.models.group import Group
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.organization import Organization
from sentry.notifications.notification_action.utils import should_fire_workflow_actions
from sentry.notifications.utils.open_period import open_period_start_for_group
from sentry.workflow_engine.endpoints.serializers.detector_serializer import (
    DetectorSerializerResponse,
)
from sentry.workflow_engine.models.action import Action

_logger = logging.getLogger(__name__)


def _get_thread_config(
    parent_notification_message: (
        NotificationActionNotificationMessage | MetricAlertNotificationMessage | None
    ),
    incident_status: IncidentStatus,
) -> tuple[bool, str | None]:
    if parent_notification_message is None:
        return False, None

    reply_broadcast = False
    # If the incident is critical status, even if it's in a thread, send to main channel
    if incident_status == IncidentStatus.CRITICAL:
        reply_broadcast = True

    return reply_broadcast, parent_notification_message.message_identifier


def _fetch_parent_notification_message_for_incident(
    organization: Organization,
    alert_context: AlertContext,
    notification_context: NotificationContext,
    metric_issue_context: MetricIssueContext,
    repository: MetricAlertNotificationMessageRepository,
) -> MetricAlertNotificationMessage | None:
    parent_notification_message = None

    with MessagingInteractionEvent(
        interaction_type=MessagingInteractionType.GET_PARENT_NOTIFICATION,
        spec=SlackMessagingSpec(),
    ).capture() as lifecycle:
        # Only grab the parent notification message for thread use if the feature is on
        # Otherwise, leave it empty, and it will not create a thread
        if OrganizationOption.objects.get_value(
            organization=organization,
            key="sentry:metric_alerts_thread_flag",
            default=METRIC_ALERTS_THREAD_DEFAULT,
        ):
            try:
                parent_notification_message = repository.get_parent_notification_message(
                    alert_rule_id=alert_context.action_identifier_id,
                    incident_id=metric_issue_context.id,
                    trigger_action_id=notification_context.id,
                )
            except Exception as e:
                lifecycle.record_halt(e)
                # if there's an error trying to grab a parent notification, don't let that error block this flow
                pass

    return parent_notification_message


def _fetch_parent_notification_message_for_notification_action(
    organization: Organization,
    notification_context: NotificationContext,
    group: Group,
    open_period_start: datetime | None,
    thread_option_default: bool,
) -> NotificationActionNotificationMessage | None:
    parent_notification_message = None

    try:
        action = Action.objects.get(id=notification_context.id)
    except Action.DoesNotExist:
        _logger.info(
            "Action not found",
            extra={"action_id": notification_context.id},
        )
        return None

    with MessagingInteractionEvent(
        interaction_type=MessagingInteractionType.GET_PARENT_NOTIFICATION,
        spec=SlackMessagingSpec(),
    ).capture() as lifecycle:
        parent_notification_message = (
            NotificationActionThreadUtils._get_notification_action_for_notification_action(
                organization=organization,
                lifecycle=lifecycle,
                action=action,
                group=group,
                open_period_start=open_period_start,
                thread_option_default=thread_option_default,
            )
        )

    return parent_notification_message


def _build_new_notification_message_payload(
    notification_context: NotificationContext,
    metric_issue_context: MetricIssueContext,
    open_period_start: datetime | None,
    parent_notification_message: NotificationActionNotificationMessage | None,
) -> NewNotificationActionNotificationMessage:
    new_notification_message_object = NewNotificationActionNotificationMessage(
        action_id=notification_context.id,
        group_id=metric_issue_context.id,
        open_period_start=open_period_start,
    )

    if parent_notification_message is not None:
        # Make sure we track that this reply will be in relation to the parent row
        new_notification_message_object.parent_notification_message_id = (
            parent_notification_message.id
        )

    return new_notification_message_object


def _build_new_metric_alert_notification_message_payload(
    notification_context: NotificationContext,
    metric_issue_context: MetricIssueContext,
    parent_notification_message: MetricAlertNotificationMessage | None,
) -> NewMetricAlertNotificationMessage:
    new_notification_message_object = NewMetricAlertNotificationMessage(
        incident_id=metric_issue_context.id,
        trigger_action_id=notification_context.id,
    )

    if parent_notification_message is not None:
        # Make sure we track that this reply will be in relation to the parent row
        new_notification_message_object.parent_notification_message_id = (
            parent_notification_message.id
        )

    return new_notification_message_object


def _build_notification_payload(
    organization: Organization,
    alert_context: AlertContext,
    metric_issue_context: MetricIssueContext,
    open_period_context: OpenPeriodContext,
    alert_rule_serialized_response: AlertRuleSerializerResponse | None,
    incident_serialized_response: DetailedIncidentSerializerResponse | None,
    detector_serialized_response: DetectorSerializerResponse | None,
    notification_uuid: str | None,
) -> tuple[str, str]:
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

    attachment: SlackBlock = SlackIncidentsMessageBuilder(
        alert_context=alert_context,
        metric_issue_context=metric_issue_context,
        organization=organization,
        date_started=open_period_context.date_started,
        chart_url=chart_url,
        notification_uuid=notification_uuid,
    ).build()
    text = str(attachment["text"])
    blocks = {"blocks": attachment["blocks"], "color": attachment["color"]}
    attachments = orjson.dumps([blocks]).decode()

    return attachments, text


def _send_notification[Msg: BaseNewNotificationMessage, Repo](
    integration: RpcIntegration,
    metric_issue_context: MetricIssueContext,
    attachments: str,
    text: str,
    channel: str,
    thread_ts: str | None,
    reply_broadcast: bool,
    notification_message_object: Msg,
    save_notification_method: Callable[[Msg, Repo], None],
    repository: Repo,
) -> bool:
    with MessagingInteractionEvent(
        interaction_type=MessagingInteractionType.SEND_INCIDENT_ALERT_NOTIFICATION,
        spec=SlackMessagingSpec(),
    ).capture() as lifecycle:
        try:
            client = SlackSdkClient(integration_id=integration.id)
            response = client.chat_postMessage(
                attachments=attachments,
                text=text,
                channel=str(channel),
                thread_ts=thread_ts,
                reply_broadcast=reply_broadcast,
                unfurl_links=False,
                unfurl_media=False,
            )
        except SlackApiError as e:
            # Record the error code and details from the exception
            notification_message_object.error_code = e.response.status_code
            notification_message_object.error_details = {
                "msg": str(e),
                "data": e.response.data,
                "url": e.response.api_url,
            }

            log_params: dict[str, str | int] = {
                "error": str(e),
                "incident_id": metric_issue_context.id,
                "incident_status": str(metric_issue_context.new_status),
                "integration_id": integration.id,
            }
            if channel:
                log_params["channel_id"] = channel

            lifecycle.add_extras(log_params)
            # If the error is a channel not found or archived, we can halt the flow
            # This means that the channel was deleted or archived after the alert rule was created
            record_lifecycle_termination_level(lifecycle, e)

        else:
            ts = response.get("ts")

            notification_message_object.message_identifier = str(ts) if ts is not None else None

    save_notification_method(notification_message_object, repository)
    return True


def _save_notification_message_metric_alert(
    notification_message_object: NewMetricAlertNotificationMessage,
    repository: MetricAlertNotificationMessageRepository,
) -> None:
    try:
        repository = get_default_metric_alert_repository()
        repository.create_notification_message(data=notification_message_object)
    except Exception:
        pass


def _save_notification_message_notification_action(
    notification_message_object: NewNotificationActionNotificationMessage,
    repository: NotificationActionNotificationMessageRepository,
) -> None:
    try:
        repository.create_notification_message(data=notification_message_object)
    except Exception:
        pass


def _handle_workflow_engine_notification(
    organization: Organization,
    notification_context: NotificationContext,
    metric_issue_context: MetricIssueContext,
    integration: RpcIntegration,
    attachments: str,
    text: str,
    channel: str,
) -> bool:
    assert metric_issue_context.group is not None

    open_period_start = open_period_start_for_group(metric_issue_context.group)

    parent_notification_message = _fetch_parent_notification_message_for_notification_action(
        organization=organization,
        notification_context=notification_context,
        group=metric_issue_context.group,
        open_period_start=open_period_start,
        thread_option_default=METRIC_ALERTS_THREAD_DEFAULT,
    )

    new_notification_message_object = _build_new_notification_message_payload(
        notification_context=notification_context,
        metric_issue_context=metric_issue_context,
        open_period_start=open_period_start,
        parent_notification_message=parent_notification_message,
    )

    reply_broadcast, thread_ts = _get_thread_config(
        parent_notification_message, metric_issue_context.new_status
    )

    return _send_notification(
        integration=integration,
        metric_issue_context=metric_issue_context,
        attachments=attachments,
        text=text,
        channel=channel,
        thread_ts=thread_ts,
        reply_broadcast=reply_broadcast,
        notification_message_object=new_notification_message_object,
        save_notification_method=_save_notification_message_notification_action,
        repository=get_default_notification_action_repository(),
    )


def _handle_legacy_notification(
    organization: Organization,
    alert_context: AlertContext,
    notification_context: NotificationContext,
    metric_issue_context: MetricIssueContext,
    integration: RpcIntegration,
    attachments: str,
    text: str,
    channel: str,
) -> bool:
    repository = get_default_metric_alert_repository()
    parent_notification_message = _fetch_parent_notification_message_for_incident(
        organization=organization,
        alert_context=alert_context,
        notification_context=notification_context,
        metric_issue_context=metric_issue_context,
        repository=repository,
    )

    new_notification_message_object = _build_new_metric_alert_notification_message_payload(
        notification_context=notification_context,
        metric_issue_context=metric_issue_context,
        parent_notification_message=parent_notification_message,
    )

    reply_broadcast, thread_ts = _get_thread_config(
        parent_notification_message, metric_issue_context.new_status
    )

    return _send_notification(
        integration=integration,
        metric_issue_context=metric_issue_context,
        attachments=attachments,
        text=text,
        channel=channel,
        thread_ts=thread_ts,
        reply_broadcast=reply_broadcast,
        notification_message_object=new_notification_message_object,
        save_notification_method=_save_notification_message_metric_alert,
        repository=repository,
    )


def send_incident_alert_notification(
    organization: Organization,
    alert_context: AlertContext,
    notification_context: NotificationContext,
    metric_issue_context: MetricIssueContext,
    open_period_context: OpenPeriodContext,
    alert_rule_serialized_response: AlertRuleSerializerResponse | None,
    incident_serialized_response: DetailedIncidentSerializerResponse | None,
    detector_serialized_response: DetectorSerializerResponse | None = None,
    notification_uuid: str | None = None,
) -> bool:
    # Make sure organization integration is still active:
    result = integration_service.organization_context(
        organization_id=organization.id, integration_id=notification_context.integration_id
    )
    integration = result.integration
    org_integration = result.organization_integration
    if org_integration is None or integration is None or integration.status != ObjectStatus.ACTIVE:
        # Integration removed, but rule is still active.
        return False

    channel = notification_context.target_identifier
    if channel is None:
        sentry_sdk.capture_message("Channel is None", level="error")
        return False

    attachments, text = _build_notification_payload(
        organization=organization,
        alert_context=alert_context,
        metric_issue_context=metric_issue_context,
        open_period_context=open_period_context,
        alert_rule_serialized_response=alert_rule_serialized_response,
        incident_serialized_response=incident_serialized_response,
        notification_uuid=notification_uuid,
        detector_serialized_response=detector_serialized_response,
    )

    # TODO(iamrajjoshi): This will need to be updated once we plan out Metric Alerts rollout
    if should_fire_workflow_actions(organization, MetricIssue.type_id):
        return _handle_workflow_engine_notification(
            organization=organization,
            notification_context=notification_context,
            metric_issue_context=metric_issue_context,
            integration=integration,
            attachments=attachments,
            text=text,
            channel=channel,
        )
    else:
        # TODO(iamrajjoshi): This needs to be deleted after ACI
        return _handle_legacy_notification(
            organization=organization,
            alert_context=alert_context,
            notification_context=notification_context,
            metric_issue_context=metric_issue_context,
            integration=integration,
            attachments=attachments,
            text=text,
            channel=channel,
        )


@dataclass(frozen=True, eq=True)
class SlackCommandResponse:
    command: str
    message: str
    log_key: str


def respond_to_slack_command(
    command_response: SlackCommandResponse,
    integration: Integration,
    slack_id: str,
    response_url: str | None,
) -> None:
    def log_msg(tag: str) -> str:
        return f"{command_response.log_key}.{tag}"

    if response_url:
        _logger.info(log_msg("respond-webhook"), extra={"response_url": response_url})
        try:
            webhook_client = WebhookClient(response_url)
            webhook_client.send(
                text=command_response.message, replace_original=False, response_type="ephemeral"
            )
        except (SlackApiError, SlackRequestError) as e:
            _logger.info(log_msg("error"), extra={"error": str(e)})
    else:
        try:
            client = SlackSdkClient(integration_id=integration.id)
            client.chat_postMessage(
                text=command_response.message,
                channel=slack_id,
                replace_original=False,
                response_type="ephemeral",
            )
        except SlackApiError as e:
            _logger.info(log_msg("error"), extra={"error": str(e)})
