from typing import Any, Dict, List, Mapping, Union
from urllib.parse import urljoin

from sentry.integrations.slack.message_builder import SlackBody
from sentry.integrations.slack.message_builder.base.base import SlackMessageBuilder
from sentry.integrations.slack.message_builder.issues import (
    SlackIssuesMessageBuilder,
    build_attachment_title,
    get_title_link,
)
from sentry.models import Team, User
from sentry.notifications.activity.release import ReleaseActivityNotification
from sentry.notifications.base import BaseNotification
from sentry.notifications.utils import get_release
from sentry.utils.http import absolute_uri

from ..utils import build_notification_footer, get_referrer_qstring


def get_group_url(notification: BaseNotification) -> str:
    return str(urljoin(notification.group.get_absolute_url(), get_referrer_qstring(notification)))


def build_deploy_buttons(notification: ReleaseActivityNotification) -> List[Dict[str, str]]:
    buttons = []
    if notification.release:
        release = get_release(notification.activity, notification.project.organization)
        if release:
            for project in notification.release.projects.all():
                project_url = absolute_uri(
                    f"/organizations/{project.organization.slug}/releases/{release.version}/?project={project.id}&unselectedSeries=Healthy/"
                )
                buttons.append(
                    {
                        "text": project.slug,
                        "name": project.slug,
                        "type": "button",
                        "url": project_url,
                    }
                )
    return buttons


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
        if self.notification.is_message_issue_unfurl:
            return SlackIssuesMessageBuilder(
                group=self.notification.group,
                event=getattr(self.notification, "event", None),
                tags=self.context.get("tags", None),
                rules=getattr(self.notification, "rules", None),
                issue_details=True,
                notification=self.notification,
                recipient=self.recipient,
            ).build()

        if isinstance(self.notification, ReleaseActivityNotification):
            return self._build(
                text="",
                actions=build_deploy_buttons(self.notification),
                footer=build_notification_footer(self.notification, self.recipient),
            )

        return self._build(
            title=build_attachment_title(self.notification.group),
            title_link=get_title_link(
                self.notification.group, None, False, False, self.notification
            ),
            text=self.notification.get_message_description(),
            footer=build_notification_footer(self.notification, self.recipient),
            color="info",
        )


def build_notification_attachment(
    notification: BaseNotification,
    context: Mapping[str, Any],
    recipient: Union[Team, User],
) -> SlackBody:
    """@deprecated"""
    return SlackNotificationsMessageBuilder(notification, context, recipient).build()
