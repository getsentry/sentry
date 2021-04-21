import logging
from typing import AbstractSet, Any, Mapping, Tuple

from sentry.integrations.slack.client import SlackClient  # NOQA
from sentry.integrations.slack.message_builder.notifications import build_notification_attachment
from sentry.models import ExternalActor, Organization, User
from sentry.notifications.activity.base import ActivityNotification
from sentry.notifications.notify import register_notification_provider
from sentry.shared_integrations.exceptions import ApiError
from sentry.types.integrations import ExternalProviders
from sentry.utils import json, metrics

logger = logging.getLogger("sentry.notifications")
SLACK_TIMEOUT = 5


def get_context(
    notification, user: User, reason: int, shared_context: Mapping[str, Any]
) -> Mapping[str, Any]:
    """ Compose the various levels of context and add slack-specific fields. """
    return {
        **shared_context,
        **notification.get_user_context(user, reason),
    }


def get_integrations_by_user_id(
    organization: Organization, users: AbstractSet[User]
) -> Mapping[User, ExternalActor]:
    actor_mapping = {user.actor_id: user for user in users}

    external_actors = ExternalActor.objects.filter(
        provider=ExternalProviders.SLACK.value,
        actor_id__in=[user.actor_id for user in users],
        organization=organization,
    ).select_related("integration")

    return {
        actor_mapping.get(external_actor.actor_id): external_actor
        for external_actor in external_actors
    }


def get_channel_and_token(
    external_actors_by_user: Mapping[User, ExternalActor], user: User
) -> Tuple[str, str]:
    external_actor = external_actors_by_user.get(user)
    channel = external_actor.external_id
    token = external_actor.integration.metadata["access_token"]
    return channel, token


@register_notification_provider(ExternalProviders.SLACK)
def send_notification_as_slack(
    notification: ActivityNotification,
    users: Mapping[User, int],
    shared_context: Mapping[str, Any],
) -> None:
    external_actors_by_user = get_integrations_by_user_id(notification.organization, users.keys())

    client = SlackClient()
    for user, reason in users.items():
        try:
            channel, token = get_channel_and_token(external_actors_by_user, user)
        except AttributeError as e:
            logger.info(
                "notification.fail.invalid_slack",
                extra={
                    "error": str(e),
                    "notification": notification,
                    "user": user.id,
                },
            )
            continue

        context = get_context(notification, user, reason, shared_context)
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
                    "user": user.id,
                    "channel_id": channel,
                },
            )
            continue

    metrics.incr(
        "activity.notifications.sent",
        instance="slack.activity.notification",
        skip_internal=False,
    )
