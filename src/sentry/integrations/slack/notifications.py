from __future__ import annotations

import logging
from collections import defaultdict
from copy import copy
from typing import Any, Iterable, List, Mapping, MutableMapping

import sentry_sdk

from sentry.constants import ObjectStatus
from sentry.integrations.mixins import NotifyBasicMixin
from sentry.integrations.slack.client import SlackClient
from sentry.integrations.slack.message_builder import SlackAttachment
from sentry.integrations.slack.message_builder.notifications import get_message_builder
from sentry.integrations.slack.tasks import post_message
from sentry.models import ExternalActor, Identity, Integration, Organization, Team, User
from sentry.notifications.additional_attachment_manager import get_additional_attachment
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
    shared_context: Mapping[str, Any],
    extra_context_by_actor_id: Mapping[int, Mapping[str, Any]] | None,
) -> List[SlackAttachment]:
    extra_context = (extra_context_by_actor_id or {}).get(recipient.actor_id, {})
    context = get_context(notification, recipient, shared_context, extra_context)
    klass = get_message_builder(notification.message_builder)
    attachments = klass(notification, context, recipient).build()
    if isinstance(attachments, List):
        return attachments
    return [attachments]


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

    integrations = Integration.objects.get_active_integrations(organization.id).filter(
        provider=EXTERNAL_PROVIDERS[ExternalProviders.SLACK],
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
                integration__status=ObjectStatus.ACTIVE,
                integration__organizationintegration__status=ObjectStatus.ACTIVE,
                # limit to org here to prevent multiple query results
                integration__organizationintegration__organization=organization,
            )
            .select_related("integration")
            .get()
        )
    except ExternalActor.DoesNotExist:
        return {}
    return {external_actor.external_id: external_actor.integration}


def get_integrations_by_channel_by_recipient(
    organization: Organization, recipients: Iterable[Team | User]
) -> MutableMapping[Team | User, Mapping[str, Integration]]:
    output: MutableMapping[Team | User, Mapping[str, Integration]] = defaultdict(dict)
    for recipient in recipients:
        channels_to_integrations = (
            get_channel_and_integration_by_user(recipient, organization)
            if isinstance(recipient, User)
            else get_channel_and_integration_by_team(recipient, organization)
        )
        output[recipient] = channels_to_integrations
    return output


def _notify_recipient(
    notification: BaseNotification,
    recipient: Team | User,
    attachments: List[SlackAttachment],
    channel: str,
    integration: Integration,
) -> None:
    with sentry_sdk.start_span(op="notification.send_slack", description="notify_recipient"):
        # Make a local copy to which we can append.
        local_attachments = copy(attachments)

        token: str = integration.metadata["access_token"]

        # Add optional billing related attachment.
        additional_attachment = get_additional_attachment(integration, notification.organization)
        if additional_attachment:
            local_attachments.append(additional_attachment)

        # unfurl_links and unfurl_media are needed to preserve the intended message format
        # and prevent the app from replying with help text to the unfurl
        payload = {
            "token": token,
            "channel": channel,
            "link_names": 1,
            "unfurl_links": False,
            "unfurl_media": False,
            "text": notification.get_notification_title(),
            "attachments": json.dumps(local_attachments),
        }

        log_params = {
            "notification": notification,
            "recipient": recipient.id,
            "channel_id": channel,
        }
        post_message.apply_async(
            kwargs={
                "payload": payload,
                "log_error_message": "notification.fail.slack_post",
                "log_params": log_params,
            }
        )
    # recording data outside of span
    notification.record_notification_sent(recipient, ExternalProviders.SLACK)


@register_notification_provider(ExternalProviders.SLACK)
def send_notification_as_slack(
    notification: BaseNotification,
    recipients: Iterable[Team | User],
    shared_context: Mapping[str, Any],
    extra_context_by_actor_id: Mapping[int, Mapping[str, Any]] | None,
) -> None:
    """Send an "activity" or "alert rule" notification to a Slack user or team."""
    with sentry_sdk.start_span(
        op="notification.send_slack", description="gen_channel_integration_map"
    ):
        data = get_integrations_by_channel_by_recipient(notification.organization, recipients)
    for recipient, integrations_by_channel in data.items():
        with sentry_sdk.start_span(op="notification.send_slack", description="send_one"):
            with sentry_sdk.start_span(op="notification.send_slack", description="gen_attachments"):
                attachments = get_attachments(
                    notification,
                    recipient,
                    shared_context,
                    extra_context_by_actor_id,
                )

            for channel, integration in integrations_by_channel.items():
                _notify_recipient(
                    notification=notification,
                    recipient=recipient,
                    attachments=attachments,
                    channel=channel,
                    integration=integration,
                )

    metrics.incr(
        f"{notification.metrics_key}.notifications.sent",
        instance=f"slack.{notification.metrics_key}.notification",
        skip_internal=False,
    )
