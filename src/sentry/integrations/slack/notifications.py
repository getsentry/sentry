import logging
from typing import Any, Mapping

from sentry.constants import ObjectStatus
from sentry.integrations.slack.client import SlackClient  # NOQA
from sentry.models import Integration, User
from sentry.notifications.activity.base import ActivityNotification
from sentry.types.integrations import ExternalProviders

logger = logging.getLogger("sentry.notifications")
SLACK_TIMEOUT = 5


def send_notification_as_slack(
    notification: ActivityNotification, user: User, context: Mapping[str, Any]
) -> None:
    integrations = Integration.objects.filter(
        organizations__in=[notification.organization],
        provider=ExternalProviders.SLACK.name.lower(),
        status=ObjectStatus.VISIBLE,
    )
    for integration in integrations:
        pass
