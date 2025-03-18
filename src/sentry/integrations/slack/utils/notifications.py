from __future__ import annotations

import logging
from dataclasses import dataclass

import orjson
import sentry_sdk
from slack_sdk.errors import SlackApiError, SlackRequestError
from slack_sdk.webhook import WebhookClient

from sentry import features
from sentry.api.serializers import serialize
from sentry.constants import METRIC_ALERTS_THREAD_DEFAULT, ObjectStatus
from sentry.incidents.charts import build_metric_alert_chart
from sentry.incidents.endpoints.serializers.alert_rule import (
    AlertRuleSerializer,
    AlertRuleSerializerResponse,
)
from sentry.incidents.endpoints.serializers.incident import (
    DetailedIncidentSerializer,
    DetailedIncidentSerializerResponse,
)
from sentry.incidents.models.alert_rule import AlertRuleTriggerAction
from sentry.incidents.models.incident import Incident, IncidentStatus
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
from sentry.integrations.metric_alerts import get_metric_count_from_incident
from sentry.integrations.models.integration import Integration
from sentry.integrations.repository import get_default_metric_alert_repository
from sentry.integrations.repository.metric_alert import (
    MetricAlertNotificationMessage,
    MetricAlertNotificationMessageRepository,
    NewMetricAlertNotificationMessage,
)
from sentry.integrations.services.integration import RpcIntegration, integration_service
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
from sentry.models.organization import Organization
from sentry.utils import metrics

_logger = logging.getLogger(__name__)


def _fetch_parent_notification_message_for_incident(
    organization: Organization,
    alert_context: AlertContext,
    notification_context: NotificationContext,
    metric_issue_context: MetricIssueContext,
) -> MetricAlertNotificationMessage | None:
    parent_notification_message = None

    with MessagingInteractionEvent(
        interaction_type=MessagingInteractionType.GET_PARENT_NOTIFICATION,
        spec=SlackMessagingSpec(),
    ).capture() as lifecycle:
        repository: MetricAlertNotificationMessageRepository = get_default_metric_alert_repository()
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


def _build_notification_payload(
    organization: Organization,
    alert_context: AlertContext,
    metric_issue_context: MetricIssueContext,
    open_period_context: OpenPeriodContext,
    alert_rule_serialized_response: AlertRuleSerializerResponse,
    incident_serialized_response: DetailedIncidentSerializerResponse,
    notification_uuid: str | None,
) -> tuple[str, str]:
    chart_url = None
    if features.has("organizations:metric-alert-chartcuterie", organization):
        try:
            chart_url = build_metric_alert_chart(
                organization=organization,
                alert_rule_serialized_response=alert_rule_serialized_response,
                snuba_query=metric_issue_context.snuba_query,
                alert_context=alert_context,
                open_period_context=open_period_context,
                selected_incident_serialized=incident_serialized_response,
                subscription=metric_issue_context.subscription,
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


def _send_notification(
    integration: RpcIntegration,
    metric_issue_context: MetricIssueContext,
    attachments: str,
    text: str,
    channel: str,
    thread_ts: str | None,
    reply_broadcast: bool,
    notification_message_object: NewMetricAlertNotificationMessage,
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

    _save_notification_message(notification_message_object)
    return True


def _save_notification_message(
    notification_message_object: NewMetricAlertNotificationMessage,
) -> None:
    try:
        repository = get_default_metric_alert_repository()
        repository.create_notification_message(data=notification_message_object)
    except Exception:
        pass


def send_incident_alert_notification(
    action: AlertRuleTriggerAction,
    incident: Incident,
    metric_value: float | int | None,
    new_status: IncidentStatus,
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

    if metric_value is None:
        metric_value = get_metric_count_from_incident(incident)

    alert_context = AlertContext.from_alert_rule_incident(incident.alert_rule)
    notification_context = NotificationContext.from_alert_rule_trigger_action(action)
    incident_context = MetricIssueContext.from_legacy_models(
        incident=incident,
        new_status=new_status,
        metric_value=metric_value,
    )
    open_period_context = OpenPeriodContext.from_incident(incident)

    organization = incident.organization

    channel = notification_context.target_identifier
    if channel is None:
        sentry_sdk.capture_message("Channel is None", level="error")
        return False

    alert_rule_serialized_response: AlertRuleSerializerResponse = serialize(
        incident.alert_rule, None, AlertRuleSerializer()
    )
    incident_serialized_response: DetailedIncidentSerializerResponse = serialize(
        incident, None, DetailedIncidentSerializer()
    )
    attachments, text = _build_notification_payload(
        organization=organization,
        alert_context=alert_context,
        metric_issue_context=incident_context,
        open_period_context=open_period_context,
        alert_rule_serialized_response=alert_rule_serialized_response,
        incident_serialized_response=incident_serialized_response,
        notification_uuid=notification_uuid,
    )

    parent_notification_message = _fetch_parent_notification_message_for_incident(
        organization=organization,
        alert_context=alert_context,
        notification_context=notification_context,
        metric_issue_context=incident_context,
    )

    new_notification_message_object = NewMetricAlertNotificationMessage(
        incident_id=incident_context.id,
        trigger_action_id=notification_context.id,
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
        if incident_context.new_status.value == IncidentStatus.CRITICAL.value:
            reply_broadcast = True

    success = _send_notification(
        integration=integration,
        metric_issue_context=incident_context,
        attachments=attachments,
        text=text,
        channel=channel,
        thread_ts=thread_ts,
        reply_broadcast=reply_broadcast,
        notification_message_object=new_notification_message_object,
    )

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
