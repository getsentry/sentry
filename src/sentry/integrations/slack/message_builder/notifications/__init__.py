from __future__ import annotations

from .base import SlackNotificationsMessageBuilder
from .digest import DigestNotificationMessageBuilder
from .issues import IssueNotificationMessageBuilder


def get_message_builder(class_name: str) -> type[SlackNotificationsMessageBuilder]:
    """TODO(mgaeta): HACK to get around circular imports."""
    return {
        "DigestNotificationMessageBuilder": DigestNotificationMessageBuilder,
        "IssueNotificationMessageBuilder": IssueNotificationMessageBuilder,
        "SlackNotificationsMessageBuilder": SlackNotificationsMessageBuilder,
    }[class_name]


__all__ = (
    "get_message_builder",
    "DigestNotificationMessageBuilder",
    "IssueNotificationMessageBuilder",
    "SlackNotificationsMessageBuilder",
)
