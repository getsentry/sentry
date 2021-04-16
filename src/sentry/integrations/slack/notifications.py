import logging
from typing import Any, Mapping

from sentry.integrations.slack.client import SlackClient  # NOQA
from sentry.integrations.slack.message_builder.notifications import build_notification_attachment
from sentry.models import ExternalActor, User
from sentry.notifications.activity.base import ActivityNotification, register
from sentry.shared_integrations.exceptions import ApiError
from sentry.types.integrations import ExternalProviders
from sentry.utils import json, metrics

logger = logging.getLogger("sentry.notifications")
SLACK_TIMEOUT = 5


@register(ExternalProviders.SLACK)
def send_notification_as_slack(
    notification: ActivityNotification, user: User, context: Mapping[str, Any]
) -> None:
    external_actors = ExternalActor.objects.filter(
        provider=ExternalProviders.SLACK.value,
        actor=user.id,
        organization=notification.organization,
    ).select_related("integration")
    for external_actor in external_actors:
        attachment = [build_notification_attachment(notification)]
        payload = {
            "token": external_actor.integration.metadata["access_token"],
            "channel": external_actor.external_id,
            "link_names": 1,
            "attachments": json.dumps(attachment),
        }
        client = SlackClient()
        try:
            client.post("/chat.postMessage", data=payload, timeout=5)
        except ApiError as e:
            logger.info(
                "notification.fail.slack_post",
                extra={
                    "error": str(e),
                    "notification": notification,
                    "user": user.id,
                    "channel_id": external_actor.external_id,
                },
            )
        metrics.incr("notifications.sent", instance="slack.notification", skip_internal=False)
