import logging
from typing import Any, Iterable, Mapping, Optional


from sentry.constants import ObjectStatus
from sentry.integrations.slack.client import SlackClient
from sentry.models import Integration
from sentry.models.integration import ExternalProviders, ExternalUser, get_provider_name
from sentry.notifications.constants import SLACK_TIMEOUT
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils import json

logger = logging.getLogger("sentry.notifications")


def get_slack_channel_id_for_user(organization: Any, integration: Any, user: Any) -> Optional[str]:
    """
    For now we're assuming that the integration is ALWAYS Sentry's Slack integration.
    We're also abusing `external_name` by expecting it to be an `external_id`.
    TODO(mgaeta): Filter by organization, actor, and integration.
    """

    entries = ExternalUser.objects.filter(
        organizationmember__organization=organization,
        organizationmember__user=user,
        provider=ExternalProviders.SLACK.value,
    )
    if not entries:
        return None

    return entries[0].external_name


def build_incident_attachment() -> Mapping[Any, Any]:
    """
    Builds a notification for Slack unfurling.
    TODO(mgaeta): Get copy from design.
    """
    return {
        "actions": [],
        "color": "#2788ce",
        "fallback": "fallback",
        "fields": [],
        "footer": "footer",
        "footer_icon": "footer_icon",
        "mrkdwn_in": ["text"],
        "text": "There is a new action for you to look at.",
        "title": "title",
        "title_link": "title_link",
    }


def get_integrations(organization: Any, provider: ExternalProviders) -> Iterable[Any]:
    """ Get all of this organization's integrations by provider. """
    return Integration.objects.filter(
        organizations__in=organization.id,
        provider=get_provider_name(provider.value),
        status=ObjectStatus.VISIBLE,
    )


def send_slack_message_to_user(
    organization: Any,
    integration: Any,
    project: Any,
    user: Any,
    activity: Any,
    group: Any,
    context: Mapping[str, Any],
) -> None:
    """ Look up the Slack channel for a user, generate a custom message, and send it. """
    channel_option = get_slack_channel_id_for_user(organization, integration, user)
    if not channel_option:
        return

    attachment = build_incident_attachment()

    payload = {
        "token": integration.metadata["access_token"],
        "channel": channel_option,
        "attachments": json.dumps([attachment]),
    }
    client = SlackClient()
    try:
        client.post("/chat.postMessage", data=payload, timeout=SLACK_TIMEOUT)
    except ApiError as e:
        logger.info("fail.slack_post", extra={"error": str(e)})
