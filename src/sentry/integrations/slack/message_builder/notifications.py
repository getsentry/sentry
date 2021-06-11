import re
from typing import Any, Mapping
from urllib.parse import urljoin

from sentry.integrations.slack.message_builder import SlackBody
from sentry.integrations.slack.message_builder.base.base import SlackMessageBuilder
from sentry.integrations.slack.message_builder.issues import SlackIssuesMessageBuilder
from sentry.notifications.base import BaseNotification
from sentry.notifications.rules import AlertRuleNotification
from sentry.utils.http import absolute_uri


def get_referrer_qstring(notification: BaseNotification) -> str:
    return "?referrer=" + re.sub("Notification$", "Slack", notification.__class__.__name__)


def get_settings_url(notification: BaseNotification) -> str:
    return str(
        urljoin(
            absolute_uri("/settings/account/notifications/"), get_referrer_qstring(notification)
        )
    )


def get_group_url(notification: BaseNotification) -> str:
    return str(urljoin(notification.group.get_absolute_url(), get_referrer_qstring(notification)))


def build_notification_footer(notification: BaseNotification) -> str:
    settings_url = get_settings_url(notification)

    if not notification.group:
        # Groups are not associated with a deploy notification so in this one
        # case, the footer is different.
        return f"<{settings_url}|Notification Settings>"

    group_url = get_group_url(notification)
    short_id = notification.group.qualified_short_id
    return f"<{group_url}|{short_id}> via <{settings_url}|Notification Settings>"


class SlackNotificationsMessageBuilder(SlackMessageBuilder):
    def __init__(self, notification: BaseNotification, context: Mapping[str, Any]) -> None:
        super().__init__()
        self.notification = notification
        self.context = context

    def build(self) -> SlackBody:
        if isinstance(self.notification, AlertRuleNotification):
            return SlackIssuesMessageBuilder(
                self.notification.group,
                self.notification.event,
                self.context["tags"],
                self.notification.rules,
                issue_alert=True,
            ).build()

        return self._build(
            footer=build_notification_footer(self.notification),
            text=self.context["text_description"],
            title=self.notification.get_title(),
        )


def build_notification_attachment(
    notification: BaseNotification, context: Mapping[str, Any]
) -> SlackBody:
    """@deprecated"""
    return SlackNotificationsMessageBuilder(notification, context).build()
