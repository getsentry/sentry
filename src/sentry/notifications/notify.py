from typing import Optional

from sentry.models.integration import ExternalProviders
from sentry.models import (
    Team,
    User,
)
from sentry.notifications.types import NotificationSettingTypes


def notify(
    provider: ExternalProviders,
    type: NotificationSettingTypes,
    user: Optional[User] = None,
    team: Optional[Team] = None,
    data: Optional[object] = None,
) -> bool:
    """
    Something noteworthy has happened. Let the targets know about what
    happened on their own terms. For each target, check their notification
    preferences and send them a message (or potentially do nothing and
    return False if this kind of correspondence is muted.)
    :param provider: ExternalProviders enum
    :param type: NotificationSettingTypes enum
    :param user: (optional) User object
    :param team: (optional) Team object
    :param data: The payload depends on the notification type.
    :returns Was a notification sent?
    """
    return False
