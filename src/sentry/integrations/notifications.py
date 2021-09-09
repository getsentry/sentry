from abc import ABC
from typing import Any, Dict, List, Mapping, Optional, Union

from sentry.integrations.slack.message_builder.issues import build_attachment_title, get_title_link
from sentry.models import Group, Team, User
from sentry.notifications.notifications.activity.new_processing_issues import (
    NewProcessingIssuesActivityNotification,
)
from sentry.notifications.notifications.activity.release import ReleaseActivityNotification
from sentry.notifications.notifications.base import BaseNotification

# TODO MARCOS extend this.
NotificationBody = Any


class AbstractMessageBuilder(ABC):
    pass


class NotificationMessageBuilderMixin:
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

    def _build(
        self,
        text: str,
        title: Optional[str] = None,
        footer: Optional[str] = None,
        color: Optional[str] = None,
        **kwargs: Any,
    ) -> NotificationBody:
        raise NotImplementedError

    def build_deploy_buttons(
        self, notification: ReleaseActivityNotification
    ) -> List[Dict[str, str]]:
        raise NotImplementedError

    def build_notification_footer(
        self, notification: BaseNotification, recipient: Union[Team, User]
    ) -> str:
        raise NotImplementedError

    def fall_back_to_alert(self, group: Group) -> str:
        raise NotImplementedError

    def build(self) -> NotificationBody:
        group = getattr(self.notification, "group", None)
        if self.notification.is_message_issue_unfurl:
            # TODO MARCOS FIRST register fallback?
            return self.fall_back_to_alert(group)

        if isinstance(self.notification, ReleaseActivityNotification):
            return self._build(
                text="",
                actions=self.build_deploy_buttons(self.notification),
                footer=self.build_notification_footer(self.notification, self.recipient),
            )

        if isinstance(self.notification, NewProcessingIssuesActivityNotification):
            return self._build(
                title=self.notification.get_title(),
                text=self.notification.get_message_description(),
                footer=self.build_notification_footer(self.notification, self.recipient),
            )

        return self._build(
            title=build_attachment_title(group),
            title_link=get_title_link(group, None, False, True, self.notification),
            text=self.notification.get_message_description(),
            footer=self.build_notification_footer(self.notification, self.recipient),
            color="info",
        )
