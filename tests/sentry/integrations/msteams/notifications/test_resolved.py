from unittest.mock import MagicMock, Mock, patch

from sentry.models.activity import Activity
from sentry.notifications.notifications.activity.resolved import ResolvedActivityNotification
from sentry.notifications.notifications.activity.resolved_in_release import (
    ResolvedInReleaseActivityNotification,
)
from sentry.testutils.cases import MSTeamsActivityNotificationTest
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType

pytestmark = [requires_snuba]


@patch(
    "sentry.integrations.msteams.MsTeamsClientMixin.get_user_conversation_id",
    Mock(return_value="some_conversation_id"),
)
@patch("sentry.integrations.msteams.MsTeamsClientMixin.send_card")
class MSTeamsResolvedNotificationTest(MSTeamsActivityNotificationTest):
    def test_resolved(self, mock_send_card: MagicMock):
        """
        Test that the card for MS Teams notification is generated correctly when an issue is resolved.
        """
        notification = ResolvedActivityNotification(
            Activity(
                project=self.project,
                group=self.group,
                user_id=self.user.id,
                type=ActivityType.SET_RESOLVED,
                data={"assignee": ""},
            )
        )
        with self.tasks():
            notification.send()

        mock_send_card.assert_called_once()

        args, kwargs = mock_send_card.call_args

        assert args[0] == "some_conversation_id"

        body = args[1]["body"]
        assert 4 == len(body)

        notification_uuid = self.get_notification_uuid(body[0]["text"])
        assert (
            f"{self.user.get_display_name()} marked [{self.group.qualified_short_id}](http://testserver/organizations/{self.organization.slug}/issues/{self.group.id}/?referrer=activity\\_notification&amp;notification\\_uuid={notification_uuid}) as resolved"
            == body[0]["text"]
        )
        assert (
            f"[{self.group.title}](http://testserver/organizations/{self.organization.slug}/issues/{self.group.id}/?referrer=resolved\\_activity-msteams&amp;notification\\_uuid="
            in body[1]["text"]
        )
        assert (
            f"{self.project.slug} | [Notification Settings](http://testserver/settings/account/notifications/workflow/?referrer=resolved\\_activity-msteams-user&amp;notification\\_uuid={notification_uuid})"
            == body[3]["columns"][1]["items"][0]["text"]
        )

    def test_resolved_in_release(self, mock_send_card):
        """
        Test that the card for MS Teams notification is generated correctly when an issue is resolved in a release.
        """
        notification = ResolvedInReleaseActivityNotification(
            Activity(
                project=self.project,
                group=self.group,
                user_id=self.user.id,
                type=ActivityType.SET_RESOLVED_IN_RELEASE,
                data={"version": "meow"},
            )
        )
        with self.tasks():
            notification.send()

        mock_send_card.assert_called_once()

        args, kwargs = mock_send_card.call_args

        assert args[0] == "some_conversation_id"

        body = args[1]["body"]
        assert 4 == len(body)

        release_name = notification.activity.data["version"]
        assert (
            f"Issue marked as resolved in {release_name} by {self.user.get_display_name()}"
            == body[0]["text"]
        )
        assert (
            f"[{self.group.title}](http://testserver/organizations/{self.organization.slug}/issues/{self.group.id}/?referrer=resolved\\_in\\_release\\_activity-msteams&amp;notification\\_uuid="
            in body[1]["text"]
        )
        notification_uuid = self.get_notification_uuid(body[3]["columns"][1]["items"][0]["text"])
        assert (
            f"{self.project.slug} | [Notification Settings](http://testserver/settings/account/notifications/workflow/?referrer=resolved\\_in\\_release\\_activity-msteams-user&amp;notification\\_uuid={notification_uuid})"
            == body[3]["columns"][1]["items"][0]["text"]
        )
