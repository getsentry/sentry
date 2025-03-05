from __future__ import annotations

import logging
from dataclasses import dataclass

import orjson
import sentry_sdk
from slack_sdk.errors import SlackApiError, SlackRequestError
from slack_sdk.webhook import WebhookClient

from sentry import features
from sentry.constants import METRIC_ALERTS_THREAD_DEFAULT, ObjectStatus
from sentry.incidents.charts import build_metric_alert_chart
from sentry.incidents.models.alert_rule import AlertRuleTriggerAction
from sentry.incidents.models.incident import Incident, IncidentStatus
from sentry.integrations.messaging.metrics import (
    MessagingInteractionEvent,
    MessagingInteractionType,
)
from sentry.integrations.metric_alerts import AlertContext, get_metric_count_from_incident
from sentry.integrations.models.integration import Integration
from sentry.integrations.repository import get_default_metric_alert_repository
from sentry.integrations.repository.metric_alert import (
    MetricAlertNotificationMessageRepository,
    NewMetricAlertNotificationMessage,
)
from sentry.integrations.services.integration import integration_service
from sentry.integrations.slack.message_builder.incidents import SlackIncidentsMessageBuilder
from sentry.integrations.slack.message_builder.types import SlackBlock
from sentry.integrations.slack.metrics import (
    SLACK_LINK_IDENTITY_MSG_FAILURE_DATADOG_METRIC,
    SLACK_LINK_IDENTITY_MSG_SUCCESS_DATADOG_METRIC,
    record_lifecycle_termination_level,
)
from sentry.integrations.slack.sdk_client import SlackSdkClient
from sentry.integrations.slack.spec import SlackMessagingSpec
from sentry.models.options.organization_option import OrganizationOption
from sentry.utils import metrics

_logger = logging.getLogger(__name__)


def send_incident_alert_notification(
    action: AlertRuleTriggerAction,
    incident: Incident,
    new_status: IncidentStatus,
    metric_value: float | None = None,
    notification_uuid: str | None = None,
) -> bool:
    # Make sure organization integration is still active:
    result = integration_service.organization_context(
        organization_id=incident.organization_id, integration_id=action.integration_id
    )
    integration = result.integration
    org_integration = result.organization_integration
    if org_integration is None or integration is None or integration.status != ObjectStatus.ACTIVE:
        # Integration removed, but rule is still active.
        return False

    organization = incident.organization
    chart_url = None
    if features.has("organizations:metric-alert-chartcuterie", incident.organization):
        try:
            chart_url = build_metric_alert_chart(
                organization=organization,
                alert_rule=incident.alert_rule,
                selected_incident=incident,
                subscription=incident.subscription,
            )
        except Exception as e:
            sentry_sdk.capture_exception(e)

    channel = action.target_identifier
    if metric_value is None:
        metric_value = get_metric_count_from_incident(incident)

    attachment: SlackBlock = SlackIncidentsMessageBuilder(
        alert_context=AlertContext.from_alert_rule_incident(incident.alert_rule),
        open_period_identifier=incident.identifier,
        organization=organization,
        snuba_query=incident.alert_rule.snuba_query,
        new_status=new_status,
        date_started=incident.date_started,
        metric_value=metric_value,
        chart_url=chart_url,
        notification_uuid=notification_uuid,
    ).build()
    text = str(attachment["text"])
    blocks = {"blocks": attachment["blocks"], "color": attachment["color"]}
    attachments = orjson.dumps([blocks]).decode()

    with MessagingInteractionEvent(
        interaction_type=MessagingInteractionType.GET_PARENT_NOTIFICATION,
        spec=SlackMessagingSpec(),
    ).capture() as lifecycle:
        repository: MetricAlertNotificationMessageRepository = get_default_metric_alert_repository()
        parent_notification_message = None
        # Only grab the parent notification message for thread use if the feature is on
        # Otherwise, leave it empty, and it will not create a thread
        if OrganizationOption.objects.get_value(
            organization=organization,
            key="sentry:metric_alerts_thread_flag",
            default=METRIC_ALERTS_THREAD_DEFAULT,
        ):
            try:
                parent_notification_message = repository.get_parent_notification_message(
                    alert_rule_id=incident.alert_rule_id,
                    incident_id=incident.id,
                    trigger_action_id=action.id,
                )
            except Exception as e:
                lifecycle.record_halt(e)
                # if there's an error trying to grab a parent notification, don't let that error block this flow
                pass

    new_notification_message_object = NewMetricAlertNotificationMessage(
        incident_id=incident.id,
        trigger_action_id=action.id,
    )

    reply_broadcast = False
    thread_ts = None
    # If a parent notification exists for this rule and action, then we can reply in a thread
    if parent_notification_message is not None:
        # Make sure we track that this reply will be in relation to the parent row
        new_notification_message_object.parent_notification_message_id = (
            parent_notification_message.id
        )
        # To reply to a thread, use the specific key in the payload as referenced by the docs
        # https://api.slack.com/methods/chat.postMessage#arg_thread_ts
        thread_ts = parent_notification_message.message_identifier

        # If the incident is critical status, even if it's in a thread, send to main channel
        if incident.status == IncidentStatus.CRITICAL.value:
            reply_broadcast = True

    success = False
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
            new_notification_message_object.error_code = e.response.status_code
            new_notification_message_object.error_details = {
                "msg": str(e),
                "data": e.response.data,
                "url": e.response.api_url,
            }

            log_params: dict[str, str | int] = {
                "error": str(e),
                "incident_id": incident.id,
                "incident_status": str(new_status),
                "attachments": attachments,
            }
            if channel:
                log_params["channel_id"] = channel
            if action.target_display:
                log_params["channel_name"] = action.target_display

            lifecycle.add_extras(log_params)
            # If the error is a channel not found or archived, we can halt the flow
            # This means that the channel was deleted or archived after the alert rule was created
            record_lifecycle_termination_level(lifecycle, e)

        else:
            success = True
            ts = response.get("ts")

            new_notification_message_object.message_identifier = str(ts) if ts is not None else None

    # Save the notification message we just sent with the response id or error we received
    try:
        repository.create_notification_message(data=new_notification_message_object)
    except Exception:
        # If we had an unexpected error with saving a record to our datastore,
        # do not let the error bubble up, nor block this flow from finishing
        pass

    return success


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
            metrics.incr(
                SLACK_LINK_IDENTITY_MSG_SUCCESS_DATADOG_METRIC,
                sample_rate=1.0,
                tags={"type": "webhook", "command": command_response.command},
            )
        except (SlackApiError, SlackRequestError) as e:
            metrics.incr(
                SLACK_LINK_IDENTITY_MSG_FAILURE_DATADOG_METRIC,
                sample_rate=1.0,
                tags={"type": "webhook", "command": command_response.command},
            )
            _logger.exception(log_msg("error"), extra={"error": str(e)})
    else:
        _logger.info(log_msg("respond-ephemeral"))
        try:
            client = SlackSdkClient(integration_id=integration.id)
            client.chat_postMessage(
                text=command_response.message,
                channel=slack_id,
                replace_original=False,
                response_type="ephemeral",
            )
            metrics.incr(
                SLACK_LINK_IDENTITY_MSG_SUCCESS_DATADOG_METRIC,
                sample_rate=1.0,
                tags={"type": "ephemeral", "command": command_response.command},
            )
        except SlackApiError as e:
            metrics.incr(
                SLACK_LINK_IDENTITY_MSG_FAILURE_DATADOG_METRIC,
                sample_rate=1.0,
                tags={"type": "ephemeral", "command": command_response.command},
            )
            _logger.exception(log_msg("error"), extra={"error": str(e)})
