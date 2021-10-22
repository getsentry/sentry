from typing import TYPE_CHECKING, Any, Mapping, Union

from sentry.integrations.slack.message_builder import SlackBody
from sentry.integrations.slack.message_builder.notifications import SlackNotificationsMessageBuilder
from sentry.notifications.notifications.organization_request import OrganizationRequestNotification

if TYPE_CHECKING:
    from sentry.models import Team, User


class SlackOrganizationRequestMessageBuilder(SlackNotificationsMessageBuilder):
    def __init__(
        self,
        notification: OrganizationRequestNotification,
        context: Mapping[str, Any],
        recipient: Union["Team", "User"],
    ) -> None:
        super().__init__(notification, context, recipient)
        # TODO: use generics here to do this
        self.notification: OrganizationRequestNotification = notification

    def build(self) -> SlackBody:
        # may need to pass more args to _build and pass recipient to certain helper functions
        return self._build(
            title=self.notification.build_attachment_title(),
            text=self.notification.get_message_description(),
            footer=self.notification.build_notification_footer(self.recipient),
            actions=self.notification.get_actions(),
            color="info",
        )
