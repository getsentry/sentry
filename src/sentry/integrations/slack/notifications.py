import logging
from typing import AbstractSet, Any, Mapping, Set, Tuple

from sentry.integrations.slack.client import SlackClient  # NOQA
from sentry.integrations.slack.message_builder.notifications import (
    build_issue_notification_attachment,
    build_notification_attachment,
)
from sentry.mail.notify import register_issue_notification_provider
from sentry.models import ExternalActor, Organization, User
from sentry.notifications.base import BaseNotification
from sentry.notifications.notify import register_notification_provider
from sentry.shared_integrations.exceptions import ApiError
from sentry.types.integrations import ExternalProviders
from sentry.utils import json, metrics

logger = logging.getLogger("sentry.notifications")
SLACK_TIMEOUT = 5


def get_context(
    notification: BaseNotification,
    user: User,
    shared_context: Mapping[str, Any],
    extra_context: Mapping[str, Any],
) -> Mapping[str, Any]:
    """ Compose the various levels of context and add slack-specific fields. """
    return {
        **shared_context,
        **notification.get_user_context(user, extra_context),
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
    notification: BaseNotification,
    users: Set[User],
    shared_context: Mapping[str, Any],
    extra_context_by_user_id: Mapping[str, Any],
) -> None:
    """ Send an "activity" or "alert rule" notification to a Slack user. """

    external_actors_by_user = get_integrations_by_user_id(notification.organization, users)

    client = SlackClient()
    for user in users:
        extra_context = (extra_context_by_user_id or {}).get(user.id, {})
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

        context = get_context(notification, user, shared_context, extra_context)
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


@register_issue_notification_provider(ExternalProviders.SLACK)
def send_issue_notification_as_slack(
    notification: Any,
    user_ids: int,
    context: Mapping[str, Any],
) -> None:
    """
    Send an "issue notification" to a Slack user which are project level issue alerts
    """
    users = User.objects.filter(id__in=list(user_ids))
    external_actors_by_user = get_integrations_by_user_id(context["project"].organization, users)

    client = SlackClient()
    for user in users:
        try:
            channel, token = get_channel_and_token(external_actors_by_user, user)
        except AttributeError as e:
            logger.info(
                "notification.fail.invalid_slack",
                extra={
                    "error": str(e),
                    "notification": "issue_alert",
                    "user": user.id,
                },
            )
            continue

        attachment = [
            build_issue_notification_attachment(
                context["group"],
                event=context["event"],
                tags=context["tags"],
                rules=context["rules"],
            )
        ]
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
                    "notification": "issue_alert",
                    "user": user.id,
                    "channel_id": channel,
                },
            )
            continue

    metrics.incr(
        "issue_alert.notifications.sent",
        instance="slack.issue_alert.notification",
        skip_internal=False,
    )
