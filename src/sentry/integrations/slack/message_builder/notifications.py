from typing import Any, Mapping
from urllib.parse import urljoin

from sentry.integrations.slack.message_builder import SlackBody
from sentry.integrations.slack.message_builder.base.base import SlackMessageBuilder
from sentry.integrations.slack.message_builder.issues import (
    SlackIssuesMessageBuilder,
    build_attachment_title,
    build_rule_url,
    get_title_link,
)
from sentry.notifications.activity import (
    AssignedActivityNotification,
    NoteActivityNotification,
    RegressionActivityNotification,
    ReleaseActivityNotification,
    ResolvedActivityNotification,
    ResolvedInReleaseActivityNotification,
    UnassignedActivityNotification,
)
from sentry.notifications.base import BaseNotification
from sentry.notifications.rules import AlertRuleNotification
from sentry.utils.http import absolute_uri

from .utils import build_notification_footer, get_referrer_qstring

ISSUE_UNFURL = (
    AlertRuleNotification,
    AssignedActivityNotification,
    RegressionActivityNotification,
    ResolvedActivityNotification,
    ResolvedInReleaseActivityNotification,
    UnassignedActivityNotification,
)


def get_group_url(notification: BaseNotification) -> str:
    return str(urljoin(notification.group.get_absolute_url(), get_referrer_qstring(notification)))


def build_notification_title(notification: BaseNotification) -> Any:
    if isinstance(notification, AlertRuleNotification):
        title_str = "Issue triggered"

        if notification.rules:
            rule_url = build_rule_url(
                notification.rules[0], notification.group, notification.group.project
            )
            title_str += f" <{rule_url}|{notification.rules[0].label}>"

            if len(notification.rules) > 1:
                title_str += f" (+{len(notification.rules) - 1} other)"

        return title_str

    return notification.get_notification_title()


class SlackNotificationsMessageBuilder(SlackMessageBuilder):
    def __init__(self, notification: BaseNotification, context: Mapping[str, Any]) -> None:
        super().__init__()
        self.notification = notification
        self.context = context

    def build(self) -> SlackBody:
        if isinstance(self.notification, ISSUE_UNFURL):
            return SlackIssuesMessageBuilder(
                group=self.notification.group,
                event=self.notification.event if hasattr(self.notification, "event") else None,
                tags=self.context.get("tags", None),
                rules=self.notification.rules if hasattr(self.notification, "rules") else None,
                issue_alert=True,
                notification=self.notification,
            ).build()

        if isinstance(self.notification, NoteActivityNotification):
            title_text = build_attachment_title(self.notification.group)
            title_link = get_title_link(self.notification.group, None, False, False)
            formatted_title = f"<{title_link}|{title_text}>"
            return self._build(
                title=formatted_title,
                text=self.context["text_description"],
                footer=build_notification_footer(self.notification),
            )

        if isinstance(self.notification, ReleaseActivityNotification):
            text = ""
            for project in self.notification.release.projects.all():
                project_url = absolute_uri(
                    f"/organizations/{self.notification.release.organization.slug}/releases/{self.notification.release.version}/?project={project.id}&unselectedSeries=Healthy/"
                )
                text += f"* <{project_url}|{project.slug}>\n"
            return self._build(
                text=text.rstrip(),
                footer=build_notification_footer(self.notification),
            )

        return self._build(
            text=self.context["text_description"],
            footer=build_notification_footer(self.notification),
        )


def build_notification_attachment(
    notification: BaseNotification, context: Mapping[str, Any]
) -> SlackBody:
    """@deprecated"""
    return SlackNotificationsMessageBuilder(notification, context).build()
