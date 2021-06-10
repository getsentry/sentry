import logging
from collections import defaultdict
from typing import AbstractSet, Any, Mapping, Set, Union

from sentry.integrations.slack.client import SlackClient  # NOQA
from sentry.integrations.slack.message_builder.notifications import build_notification_attachment
from sentry.models import ExternalActor, Identity, Integration, Organization, Team, User
from sentry.notifications.activity.base import ActivityNotification
from sentry.notifications.base import BaseNotification
from sentry.notifications.notify import register_notification_provider
from sentry.notifications.rules import AlertRuleNotification
from sentry.shared_integrations.exceptions import ApiError
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders
from sentry.utils import json, metrics

logger = logging.getLogger("sentry.notifications")
SLACK_TIMEOUT = 5


def get_context(
    notification: BaseNotification,
    recipient: Union[User, Team],
    shared_context: Mapping[str, Any],
    extra_context: Mapping[str, Any],
) -> Mapping[str, Any]:
    """Compose the various levels of context and add Slack-specific fields."""
    return {
        **shared_context,
        **notification.get_user_context(recipient, extra_context),
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
    organization: Organization, recipients: AbstractSet[Union[User, Team]]
) -> Mapping[Union[User, Team], Mapping[str, str]]:
    output = defaultdict(dict)
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


def get_key(notification: BaseNotification) -> str:
    if isinstance(notification, ActivityNotification):
        return "activity"
    elif isinstance(notification, AlertRuleNotification):
        return "issue_alert"
    else:
        return ""


@register_notification_provider(ExternalProviders.SLACK)
def send_notification_as_slack(
    notification: BaseNotification,
    recipients: Union[Set[User], Set[Team]],
    shared_context: Mapping[str, Any],
    extra_context_by_user_id: Mapping[str, Any],
) -> None:
    """Send an "activity" or "alert rule" notification to a Slack user or team."""
    client = SlackClient()
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
        extra_context = (extra_context_by_user_id or {}).get(recipient.id, {})
        context = get_context(notification, recipient, shared_context, extra_context)
        attachment = [build_notification_attachment(notification, context)]
        for channel, token in tokens_by_channel.items():
            payload = {
                "token": token,
                "channel": channel,
                "link_names": 1,
                "attachments": json.dumps(attachment),
            }
            try:
                client.post("/chat.postMessage", data=payload, timeout=5)
            except ApiError as e:
                logger.info(
                    "notification.fail.slack_post",
                    extra={
                        "error": str(e),
                        "notification": notification,
                        "recipient": recipient.id,
                        "channel_id": channel,
                        "is_multiple": is_multiple,
                    },
                )
                continue

    key = get_key(notification)
    metrics.incr(
        f"{key}.notifications.sent",
        instance=f"slack.{key}.notification",
        skip_internal=False,
    )
