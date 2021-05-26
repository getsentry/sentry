import logging
from typing import AbstractSet, Any, Mapping, Set, Tuple, Union

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
    """ Compose the various levels of context and add slack-specific fields. """
    return {
        **shared_context,
        **notification.get_user_context(recipient, extra_context),
    }


def get_integrations_by_recipient_id(
    organization: Organization, recipients: AbstractSet[Union[User, Team]]
) -> Mapping[Union[User, Team], Union[ExternalActor, Identity]]:

    output = {}
    for recipient in recipients:
        if isinstance(recipient, User):
            try:
                identity = Identity.objects.get(
                    idp__type=EXTERNAL_PROVIDERS[ExternalProviders.SLACK],
                    user=recipient.id,
                )
            except Identity.DoesNotExist:
                # the user may not have linked their identity so just move on
                # since there are likely other users or teams in the list of recipients
                continue
            output[recipient] = identity
        else:
            external_actor = ExternalActor.objects.filter(
                provider=ExternalProviders.SLACK.value,
                actor_id=recipient.actor_id,
                organization=organization,
            ).select_related("integration")[0]
            output[recipient] = external_actor
    return output


def get_channel_and_token(
    external_identity_by_recipient: Mapping[Union[User, Team], Union[ExternalActor, Identity]],
    recipient: Union[User, Team],
    notification: BaseNotification,
) -> Tuple[str, str]:
    external_actor = external_identity_by_recipient.get(recipient)
    channel = external_actor.external_id
    if isinstance(recipient, User):
        integration = Integration.objects.get(
            provider=external_actor.idp.type,
            organizations=notification.organization,
        )
        token = integration.metadata["access_token"]
    else:
        token = external_actor.integration.metadata["access_token"]
    return channel, token


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
    """ Send an "activity" or "alert rule" notification to a Slack user or team. """

    external_identity_by_recipient = get_integrations_by_recipient_id(
        notification.organization, recipients
    )
    client = SlackClient()
    for recipient in recipients:
        extra_context = (extra_context_by_user_id or {}).get(recipient.id, {})
        try:
            channel, token = get_channel_and_token(
                external_identity_by_recipient, recipient, notification
            )
        except AttributeError as e:
            logger.info(
                "notification.fail.invalid_slack",
                extra={
                    "error": str(e),
                    "notification": notification,
                    "recipient": recipient.id,
                },
            )
            continue

        context = get_context(notification, recipient, shared_context, extra_context)
        attachment = [build_notification_attachment(notification, context)]
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
                },
            )
            continue

    key = get_key(notification)
    metrics.incr(
        f"{key}.notifications.sent",
        instance=f"slack.{key}.notification",
        skip_internal=False,
    )
