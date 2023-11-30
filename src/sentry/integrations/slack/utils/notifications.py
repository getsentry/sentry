from __future__ import annotations

from typing import Any, Mapping

import sentry_sdk

from sentry import features
from sentry.constants import ObjectStatus
from sentry.incidents.charts import build_metric_alert_chart
from sentry.incidents.models import AlertRuleTriggerAction, Incident, IncidentStatus
from sentry.integrations.slack.client import SlackClient
from sentry.integrations.slack.message_builder.incidents import SlackIncidentsMessageBuilder
from sentry.models.integrations.integration import Integration
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.shared_integrations.exceptions import ApiError
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

    chart_url = None
    if features.has("organizations:metric-alert-chartcuterie", incident.organization):
        try:
            chart_url = build_metric_alert_chart(
                organization=incident.organization,
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

    client = SlackClient(integration_id=integration.id)
    try:
        client.post("/chat.postMessage", data=payload, timeout=5)
        return True
    except ApiError:
        logger.info("rule.fail.slack_post", exc_info=True)
    return False


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
