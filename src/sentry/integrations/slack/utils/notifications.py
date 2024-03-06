from __future__ import annotations

from collections.abc import Mapping
from typing import Any

import sentry_sdk

from sentry import features
from sentry.constants import ObjectStatus
from sentry.incidents.charts import build_metric_alert_chart
from sentry.incidents.models import AlertRuleTriggerAction, Incident, IncidentStatus
from sentry.integrations.repository import get_default_metric_alert_repository
from sentry.integrations.repository.metric_alert import (
    MetricAlertNotificationMessageRepository,
    NewMetricAlertNotificationMessage,
)
from sentry.integrations.slack.client import SlackClient
from sentry.integrations.slack.message_builder.incidents import SlackIncidentsMessageBuilder
from sentry.models.integrations.integration import Integration
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.shared_integrations.exceptions import ApiError
from sentry.shared_integrations.response import BaseApiResponse, MappingApiResponse
from sentry.utils import json

from . import logger


def send_incident_alert_notification(
    action: AlertRuleTriggerAction,
    incident: Incident,
    metric_value: float,
    new_status: IncidentStatus,
    notification_uuid: str | None = None,
) -> bool:
    # Make sure organization integration is still active:
    integration, org_integration = integration_service.get_organization_context(
        organization_id=incident.organization_id, integration_id=action.integration_id
    )
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
            )
        except Exception as e:
            sentry_sdk.capture_exception(e)

    channel = action.target_identifier
    attachment: Any = SlackIncidentsMessageBuilder(
        incident, new_status, metric_value, chart_url, notification_uuid
    ).build()
    text = attachment["text"]
    blocks = {"blocks": attachment["blocks"], "color": attachment["color"]}

    payload = {
        "channel": channel,
        "text": text,
        "attachments": json.dumps([blocks]),
        # Prevent duplicate unfurl
        # https://api.slack.com/reference/messaging/link-unfurling#no_unfurling_please
        "unfurl_links": False,
        "unfurl_media": False,
    }

    repository: MetricAlertNotificationMessageRepository = get_default_metric_alert_repository()
    parent_notification_message = None
    if features.has("organizations:slack-thread", organization):
        try:
            parent_notification_message = repository.get_parent_notification_message(
                alert_rule_id=incident.alert_rule_id,
                incident_id=incident.id,
                trigger_action_id=action.id,
            )
        except Exception:
            # if there's an error trying to grab a parent notification, don't let that error block this flow
            pass

    new_notification_message_object = NewMetricAlertNotificationMessage(
        incident_id=incident.id,
        trigger_action_id=action.id,
    )

    # Only reply and use threads if the organization is enabled in the FF
    if features.has("organizations:slack-thread", organization):
        # If a parent notification exists for this rule and action, then we can reply in a thread
        if parent_notification_message is not None:
            # Make sure we track that this reply will be in relation to the parent row
            new_notification_message_object.parent_notification_message_id = (
                parent_notification_message.id
            )
            # To reply to a thread, use the specific key in the payload as referenced by the docs
            # https://api.slack.com/methods/chat.postMessage#arg_thread_ts
            payload["thread_ts"] = parent_notification_message.message_identifier

            # If the incident is critical status, even if it's in a thread, send to main channel
            if incident.status == IncidentStatus.CRITICAL.value:
                payload["reply_broadcast"] = True

    client = SlackClient(integration_id=integration.id)
    success = False
    try:
        response = client.post("/chat.postMessage", data=payload, timeout=5)
        # response should include a "ts" key that represents the unique identifier for the message
        # referenced at https://api.slack.com/methods/chat.postMessage#examples
    except ApiError as e:
        # Record the error code and details from the exception
        new_notification_message_object.error_code = e.code
        new_notification_message_object.error_details = {
            "url": e.url,
            "host": e.host,
            "path": e.path,
            "data": e.json if e.json else e.text,
        }
        logger.info("rule.fail.slack_post", exc_info=True)
    else:
        success = True
        # Slack will always send back a ts identifier https://api.slack.com/methods/chat.postMessage#examples
        # on a successful message
        ts = None
        # This is a workaround for typing, and the dynamic nature of the return value
        if isinstance(response, BaseApiResponse):
            ts = response.json.get("ts")
        elif isinstance(response, MappingApiResponse):
            ts = response.get("ts")
        else:
            logger.info(
                "failed to get ts from slack response",
                extra={
                    "response_type": type(response).__name__,
                },
            )
        new_notification_message_object.message_identifier = str(ts) if ts is not None else None

    if features.has("organizations:slack-thread", organization):
        # Save the notification message we just sent with the response id or error we received
        try:
            repository.create_notification_message(data=new_notification_message_object)
        except Exception:
            # If we had an unexpected error with saving a record to our datastore,
            # do not let the error bubble up, nor block this flow from finishing
            pass

    return success


def send_slack_response(
    integration: Integration, text: str, params: Mapping[str, str], command: str
) -> None:
    payload = {
        "replace_original": False,
        "response_type": "ephemeral",
        "text": text,
    }

    client = SlackClient(integration_id=integration.id)
    if params["response_url"]:
        path = params["response_url"]

    else:
        # Command has been invoked in a DM, not as a slash command
        # we do not have a response URL in this case
        payload["channel"] = params["slack_id"]
        path = "/chat.postMessage"

    try:
        client.post(path, data=payload, json=True)
    except ApiError as e:
        message = str(e)
        # If the user took their time to link their slack account, we may no
        # longer be able to respond, and we're not guaranteed able to post into
        # the channel. Ignore Expired url errors.
        #
        # XXX(epurkhiser): Yes the error string has a space in it.
        if message != "Expired url":
            log_message = (
                "slack.link-notify.response-error"
                if command == "link"
                else "slack.unlink-notify.response-error"
            )
            logger.error(log_message, extra={"error": message})
