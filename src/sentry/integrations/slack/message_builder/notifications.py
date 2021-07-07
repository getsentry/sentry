import re
from typing import Any, Mapping
from urllib.parse import urljoin

from sentry.integrations.slack.message_builder import SlackBody
from sentry.integrations.slack.message_builder.base.base import SlackMessageBuilder
from sentry.integrations.slack.message_builder.issues import SlackIssuesMessageBuilder
from sentry.models import Project
from sentry.notifications.activity import ReleaseActivityNotification
from sentry.notifications.activity.base import ActivityNotification
from sentry.notifications.base import BaseNotification
from sentry.notifications.rules import AlertRuleNotification
from sentry.utils.http import absolute_uri


def get_referrer_qstring(notification: BaseNotification) -> str:
    return "?referrer=" + re.sub("Notification$", "Slack", notification.__class__.__name__)


def get_settings_url(notification: BaseNotification) -> str:
    if isinstance(notification, ReleaseActivityNotification):
        fine_tuning = "deploy/"
    elif isinstance(notification, ActivityNotification):
        fine_tuning = "workflow/"
    elif isinstance(notification, AlertRuleNotification):
        fine_tuning = "alerts/"
    else:
        fine_tuning = ""

    url_str = f"/settings/account/notifications/{fine_tuning}"
    return str(urljoin(absolute_uri(url_str), get_referrer_qstring(notification)))


def get_group_url(notification: BaseNotification) -> str:
    return str(urljoin(notification.group.get_absolute_url(), get_referrer_qstring(notification)))


def build_notification_footer(notification: BaseNotification) -> str:
    settings_url = get_settings_url(notification)
    if isinstance(notification, ReleaseActivityNotification):
        # temp while I figure out what to put here for deploys
        return f"<{settings_url}|Notification Settings>"

    project = Project.objects.get_from_cache(id=notification.group.project_id)
    return f"{project.slug} | <{settings_url}|Notification Settings>"


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
            title=self.notification.get_notification_title(),
        )


def build_notification_attachment(
    notification: BaseNotification, context: Mapping[str, Any]
) -> SlackBody:
    """@deprecated"""
    return SlackNotificationsMessageBuilder(notification, context).build()
