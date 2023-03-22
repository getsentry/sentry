from unittest.mock import MagicMock, Mock, patch

from sentry.models import Activity
from sentry.notifications.notifications.activity import AssignedActivityNotification
from sentry.testutils.cases import MSTeamsActivityNotificationTest
from sentry.types.activity import ActivityType


@patch(
    "sentry.integrations.msteams.MsTeamsAbstractClient.get_user_conversation_id",
    Mock(return_value="some_conversation_id"),
)
@patch("sentry.integrations.msteams.MsTeamsAbstractClient.send_card")
class MSTeamsAssignedNotificationTest(MSTeamsActivityNotificationTest):
    def test_assigned(self, mock_send_card: MagicMock):
        """
        Test that the card for MS Teams notification is generated correctly for issue assignment.
        """
        notification = AssignedActivityNotification(
            Activity(
                project=self.project,
                group=self.group,
                user_id=self.user.id,
                type=ActivityType.ASSIGNED,
                data={"assignee": self.user.id},
            )
        )
        with self.tasks():
            notification.send()

        mock_send_card.assert_called_once()

        args, kwargs = mock_send_card.call_args

        assert args[0] == "some_conversation_id"

        body = args[1]["body"]
        assert 4 == len(body)

        assert f"Issue assigned to {self.user.get_display_name()} by themselves" == body[0]["text"]
        assert (
            f"[{self.group.title}](http://testserver/organizations/{self.organization.slug}/issues/{self.group.id}/?referrer=assigned\\_activity-msteams)"
            == body[1]["text"]
        )
        assert (
            f"{self.project.slug} | [Notification Settings](http://testserver/settings/account/notifications/workflow/?referrer=assigned\\_activity-msteams-user)"
            == body[3]["columns"][1]["items"][0]["text"]
        )

    def test_assigned_automatically(self, mock_send_card: MagicMock):
        """
        Test that the card for MS Teams notification is generated correctly for issue assignment by Sentry.
        """
        notification = AssignedActivityNotification(
            Activity(
                project=self.project,
                group=self.group,
                type=ActivityType.ASSIGNED,
                data={"assignee": self.user.id},
            )
        )
        with self.tasks():
            notification.send()

        mock_send_card.assert_called_once()

        args, kwargs = mock_send_card.call_args

        assert args[0] == "some_conversation_id"

        body = args[1]["body"]
        assert 4 == len(body)

        assert f"Issue automatically assigned to {self.user.get_display_name()}" == body[0]["text"]
        assert (
            f"[{self.group.title}](http://testserver/organizations/{self.organization.slug}/issues/{self.group.id}/?referrer=assigned\\_activity-msteams)"
            == body[1]["text"]
        )
        assert (
            f"{self.project.slug} | [Notification Settings](http://testserver/settings/account/notifications/workflow/?referrer=assigned\\_activity-msteams-user)"
            == body[3]["columns"][1]["items"][0]["text"]
        )
