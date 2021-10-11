import re
from typing import Mapping, Union
from urllib.parse import urljoin

from django.http import HttpResponse
from rest_framework.request import Request

from sentry.constants import ObjectStatus
from sentry.incidents.models import AlertRuleTriggerAction, Incident
from sentry.integrations.slack.client import SlackClient
from sentry.integrations.slack.message_builder.incidents import SlackIncidentsMessageBuilder
from sentry.models import Environment, Integration, Team, User
from sentry.notifications.notifications.activity.release import ReleaseActivityNotification
from sentry.notifications.notifications.base import BaseNotification
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils import json
from sentry.utils.http import absolute_uri
from sentry.web.helpers import render_to_response

from . import logger


def send_incident_alert_notification(
    action: AlertRuleTriggerAction,
    incident: Incident,
    metric_value: int,
    method: str,
) -> None:
    # Make sure organization integration is still active:
    try:
        integration = Integration.objects.get(
            id=action.integration_id,
            organizations=incident.organization,
            status=ObjectStatus.VISIBLE,
        )
    except Integration.DoesNotExist:
        # Integration removed, but rule is still active.
        return

    channel = action.target_identifier
    attachment = SlackIncidentsMessageBuilder(incident, action, metric_value, method).build()
    payload = {
        "token": integration.metadata["access_token"],
        "channel": channel,
        "attachments": json.dumps([attachment]),
    }

    client = SlackClient()
    try:
        client.post("/chat.postMessage", data=payload, timeout=5)
    except ApiError as e:
        logger.info("rule.fail.slack_post", extra={"error": str(e)})


def send_confirmation(
    integration: Integration,
    channel_id: str,
    heading: str,
    text: str,
    template: str,
    request: Request,
) -> HttpResponse:
    client = SlackClient()
    token = integration.metadata.get("user_access_token") or integration.metadata["access_token"]
    payload = {
        "token": token,
        "channel": channel_id,
        "text": text,
    }

    headers = {"Authorization": f"Bearer {token}"}
    try:
        client.post("/chat.postMessage", headers=headers, data=payload, json=True)
    except ApiError as e:
        message = str(e)
        if message != "Expired url":
            logger.error("slack.slash-notify.response-error", extra={"error": message})
    else:
        return render_to_response(
            template,
            request=request,
            context={
                "heading_text": heading,
                "body_text": text,
                "channel_id": channel_id,
                "team_id": integration.external_id,
            },
        )


def get_referrer_qstring(notification: BaseNotification, recipient: Union["Team", "User"]) -> str:
    return (
        "?referrer="
        + re.sub("Notification$", "Slack", notification.__class__.__name__)
        + str(recipient.__class__.__name__)
    )


def get_settings_url(notification: BaseNotification, recipient: Union["Team", "User"]) -> str:
    url_str = "/settings/account/notifications/"
    if notification.fine_tuning_key:
        url_str += f"{notification.fine_tuning_key}/"
    return str(urljoin(absolute_uri(url_str), get_referrer_qstring(notification, recipient)))


def build_notification_footer(
    notification: BaseNotification, recipient: Union["Team", "User"]
) -> str:
    if isinstance(recipient, Team):
        team = Team.objects.get(id=recipient.id)
        url_str = f"/settings/{notification.organization.slug}/teams/{team.slug}/notifications/"
        settings_url = str(
            urljoin(absolute_uri(url_str), get_referrer_qstring(notification, recipient))
        )
    else:
        settings_url = get_settings_url(notification, recipient)

    if isinstance(notification, ReleaseActivityNotification):
        # no environment related to a deploy
        if notification.release:
            return f"{notification.release.projects.all()[0].slug} | <{settings_url}|Notification Settings>"
        return f"<{settings_url}|Notification Settings>"

    footer: str = notification.project.slug
    group = getattr(notification, "group", None)
    latest_event = group.get_latest_event() if group else None
    environment = None
    if latest_event:
        try:
            environment = latest_event.get_environment()
        except Environment.DoesNotExist:
            pass
    if environment and getattr(environment, "name", None) != "":
        footer += f" | {environment.name}"
    footer += f" | <{settings_url}|Notification Settings>"
    return footer


def send_slack_response(
    integration: Integration, text: str, params: Mapping[str, str], command: str
) -> None:
    payload = {
        "replace_original": False,
        "response_type": "ephemeral",
        "text": text,
    }

    client = SlackClient()
    if params["response_url"]:
        path = params["response_url"]
        headers = {}

    else:
        # Command has been invoked in a DM, not as a slash command
        # we do not have a response URL in this case
        token = (
            integration.metadata.get("user_access_token") or integration.metadata["access_token"]
        )
        headers = {"Authorization": f"Bearer {token}"}
        payload["token"] = token
        payload["channel"] = params["slack_id"]
        path = "/chat.postMessage"

    try:
        client.post(path, headers=headers, data=payload, json=True)
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
