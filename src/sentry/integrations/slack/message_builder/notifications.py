from typing import Any, Mapping, Union
from urllib.parse import urljoin

from sentry.integrations.slack.message_builder import SlackBody
from sentry.integrations.slack.message_builder.base.base import SlackMessageBuilder
from sentry.integrations.slack.message_builder.issues import (
    SlackIssuesMessageBuilder,
    build_attachment_title,
    build_rule_url,
    get_title_link,
)
from sentry.models import Team, User
from sentry.notifications.activity.assigned import AssignedActivityNotification
from sentry.notifications.activity.note import NoteActivityNotification
from sentry.notifications.activity.regression import RegressionActivityNotification
from sentry.notifications.activity.release import ReleaseActivityNotification
from sentry.notifications.activity.resolved import ResolvedActivityNotification
from sentry.notifications.activity.resolved_in_release import ResolvedInReleaseActivityNotification
from sentry.notifications.activity.unassigned import UnassignedActivityNotification
from sentry.notifications.base import BaseNotification
from sentry.notifications.rules import AlertRuleNotification
from sentry.utils.http import absolute_uri

from ..utils import build_notification_footer, get_referrer_qstring

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
    def __init__(
        self,
        notification: BaseNotification,
        context: Mapping[str, Any],
        recipient: Union[Team, User],
    ) -> None:
        super().__init__()
        self.notification = notification
        self.context = context
        self.recipient = recipient

    def build(self) -> SlackBody:
        if isinstance(self.notification, ISSUE_UNFURL):
            return SlackIssuesMessageBuilder(
                group=self.notification.group,
                event=getattr(self.notification, "event", None),
                tags=self.context.get("tags", None),
                rules=getattr(self.notification, "rules", None),
                issue_details=True,
                notification=self.notification,
                recipient=self.recipient,
            ).build()

        if isinstance(self.notification, NoteActivityNotification):
            title_text = build_attachment_title(self.notification.group)
            title_link = get_title_link(
                self.notification.group, None, False, False, self.notification
            )
            formatted_title = f"<{title_link}|{title_text}>"
            return self._build(
                title=formatted_title,
                text=self.context["text_description"],
                footer=build_notification_footer(self.notification, self.recipient),
            )

        if isinstance(self.notification, ReleaseActivityNotification):
            text = ""
            if self.notification.release:
                for project in self.notification.release.projects.all():
                    project_url = absolute_uri(
                        f"/organizations/{self.notification.release.organization.slug}/releases/{self.notification.release.version}/?project={project.id}&unselectedSeries=Healthy/"
                    )
                    text += f"* <{project_url}|{project.slug}>\n"
            return self._build(
                text=text.rstrip(),
                footer=build_notification_footer(self.notification, self.recipient),
            )

        return self._build(
            text=self.context["text_description"],
            footer=build_notification_footer(self.notification, self.recipient),
        )


def build_notification_attachment(
    notification: BaseNotification,
    context: Mapping[str, Any],
    recipient: Union[Team, User],
) -> SlackBody:
    """@deprecated"""
    return SlackNotificationsMessageBuilder(notification, context, recipient).build()
