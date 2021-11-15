from __future__ import annotations

import logging
from collections import defaultdict
from typing import Any, Iterable, Mapping, MutableMapping

from sentry.integrations.notifications import NotifyBasicMixin
from sentry.integrations.slack.client import SlackClient
from sentry.integrations.slack.message_builder import SlackBody
from sentry.integrations.slack.message_builder.notifications import get_message_builder
from sentry.integrations.slack.tasks import post_message
from sentry.models import ExternalActor, Identity, Integration, Organization, Team, User
from sentry.notifications.notifications.base import BaseNotification
from sentry.notifications.notify import register_notification_provider
from sentry.shared_integrations.exceptions import ApiError
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders
from sentry.utils import json, metrics

logger = logging.getLogger("sentry.notifications")
SLACK_TIMEOUT = 5


class SlackNotifyBasicMixin(NotifyBasicMixin):  # type: ignore
    def send_message(self, channel_id: str, message: str) -> None:
        client = SlackClient()
        token = self.metadata.get("user_access_token") or self.metadata["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        payload = {
            "token": token,
            "channel": channel_id,
            "text": message,
        }
        try:
            client.post("/chat.postMessage", headers=headers, data=payload, json=True)
        except ApiError as e:
            message = str(e)
            if message != "Expired url":
                logger.error("slack.slash-notify.response-error", extra={"error": message})
        return


def get_attachments(
    notification: BaseNotification,
    recipient: Team | User,
    context: Mapping[str, Any],
) -> SlackBody:
    klass = get_message_builder(notification.message_builder)
    attachments = klass(notification, context, recipient).build()
    if isinstance(attachments, dict):
        return [attachments]
    return attachments


def get_context(
    notification: BaseNotification,
    recipient: Team | User,
    shared_context: Mapping[str, Any],
    extra_context: Mapping[str, Any],
) -> Mapping[str, Any]:
    """Compose the various levels of context and add Slack-specific fields."""
    return {
        **shared_context,
        **notification.get_recipient_context(recipient, extra_context),
    }


def get_channel_and_integration_by_user(
    user: User, organization: Organization
) -> Mapping[str, Integration]:

    identities = Identity.objects.filter(
        idp__type=EXTERNAL_PROVIDERS[ExternalProviders.SLACK],
        user=user.id,
    ).select_related("idp")

    if not identities:
        # The user may not have linked their identity so just move on
        # since there are likely other users or teams in the list of
        # recipients.
        return {}

    integrations = Integration.objects.filter(
        provider=EXTERNAL_PROVIDERS[ExternalProviders.SLACK],
        organizations=organization,
        external_id__in=[identity.idp.external_id for identity in identities],
    )

    channels_to_integration = {}
    for identity in identities:
        for integration in integrations:
            if identity.idp.external_id == integration.external_id:
                channels_to_integration[identity.external_id] = integration
                break

    return channels_to_integration


def get_channel_and_integration_by_team(
    team: Team, organization: Organization
) -> Mapping[str, Integration]:
    try:
        external_actor = (
            ExternalActor.objects.filter(
                provider=ExternalProviders.SLACK.value,
                actor_id=team.actor_id,
                organization=organization,
            )
            .select_related("integration")
            .get()
        )
    except ExternalActor.DoesNotExist:
        return {}

    return {external_actor.external_id: external_actor.integration}


def get_channel_and_token_by_recipient(
    organization: Organization, recipients: Iterable[Team | User]
) -> Mapping[Team | User, Mapping[str, str]]:
    output: MutableMapping[Team | User, MutableMapping[str, str]] = defaultdict(dict)
    for recipient in recipients:
        channels_to_integrations = (
            get_channel_and_integration_by_user(recipient, organization)
            if isinstance(recipient, User)
            else get_channel_and_integration_by_team(recipient, organization)
        )
        for channel, integration in channels_to_integrations.items():
            try:
                token = integration.metadata["access_token"]
            except AttributeError as e:
                logger.info(
                    "notification.fail.invalid_slack",
                    extra={
                        "error": str(e),
                        "organization": organization,
                        "recipient": recipient.id,
                    },
                )
                continue

            output[recipient][channel] = token
    return output


@register_notification_provider(ExternalProviders.SLACK)
def send_notification_as_slack(
    notification: BaseNotification,
    recipients: Iterable[Team | User],
    shared_context: Mapping[str, Any],
    extra_context_by_actor_id: Mapping[int, Mapping[str, Any]] | None,
) -> None:
    """Send an "activity" or "alert rule" notification to a Slack user or team."""
    data = get_channel_and_token_by_recipient(notification.organization, recipients)

    for recipient, tokens_by_channel in data.items():
        is_multiple = True if len([token for token in tokens_by_channel]) > 1 else False
        if is_multiple:
            logger.info(
                "notification.multiple.slack_post",
                extra={
                    "notification": notification,
                    "recipient": recipient.id,
                },
            )
        extra_context = (extra_context_by_actor_id or {}).get(recipient.actor_id, {})
        context = get_context(notification, recipient, shared_context, extra_context)
        attachments = get_attachments(notification, recipient, context)

        for channel, token in tokens_by_channel.items():
            # unfurl_links and unfurl_media are needed to preserve the intended message format
            # and prevent the app from replying with help text to the unfurl
            payload = {
                "token": token,
                "channel": channel,
                "link_names": 1,
                "unfurl_links": False,
                "unfurl_media": False,
                "text": notification.get_notification_title(),
                "attachments": json.dumps(attachments),
            }
            log_params = {
                "notification": notification,
                "recipient": recipient.id,
                "channel_id": channel,
                "is_multiple": is_multiple,
            }
            post_message.apply_async(
                kwargs={
                    "payload": payload,
                    "log_error_message": "notification.fail.slack_post",
                    "log_params": log_params,
                }
            )
            notification.record_notification_sent(recipient, ExternalProviders.SLACK)

    key = notification.metrics_key
    metrics.incr(
        f"{key}.notifications.sent",
        instance=f"slack.{key}.notification",
        skip_internal=False,
    )
