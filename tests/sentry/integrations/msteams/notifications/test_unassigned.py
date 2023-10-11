from unittest.mock import MagicMock, Mock, patch

from sentry.models.activity import Activity
from sentry.notifications.notifications.activity.unassigned import UnassignedActivityNotification
from sentry.testutils.cases import MSTeamsActivityNotificationTest
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType

pytestmark = [requires_snuba]


@patch(
    "sentry.integrations.msteams.MsTeamsClientMixin.get_user_conversation_id",
    Mock(return_value="some_conversation_id"),
)
@patch("sentry.integrations.msteams.MsTeamsClientMixin.send_card")
class MSTeamsUnassignedNotificationTest(MSTeamsActivityNotificationTest):
    def test_unassigned(self, mock_send_card: MagicMock):
        """
        Test that the card for MS Teams notification is generated correctly for issue unassignment.
        """
        notification = UnassignedActivityNotification(
            Activity(
                project=self.project,
                group=self.group,
                user_id=self.user.id,
                type=ActivityType.ASSIGNED,
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

        notification_uuid = self.get_notification_uuid(body[1]["text"])
        assert f"Issue unassigned by {self.user.get_display_name()}" == body[0]["text"]
        assert (
            f"[{self.group.title}](http://testserver/organizations/{self.organization.slug}/issues/{self.group.id}/?referrer=unassigned\\_activity-msteams&amp;notification\\_uuid="
            in body[1]["text"]
        )
        assert (
            f"{self.project.slug} | [Notification Settings](http://testserver/settings/account/notifications/workflow/?referrer=unassigned\\_activity-msteams-user&amp;notification\\_uuid={notification_uuid})"
            == body[3]["columns"][1]["items"][0]["text"]
        )

    def test_unassigned_automatically(self, mock_send_card: MagicMock):
        """
        Test that the card for MS Teams notification is generated correctly for issue unassignment by Sentry.
        """
        notification = UnassignedActivityNotification(
            Activity(
                project=self.project,
                group=self.group,
                type=ActivityType.ASSIGNED,
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

        notification_uuid = self.get_notification_uuid(body[1]["text"])
        assert "Issue unassigned by Sentry" == body[0]["text"]
        assert (
            f"[{self.group.title}](http://testserver/organizations/{self.organization.slug}/issues/{self.group.id}/?referrer=unassigned\\_activity-msteams&amp;notification\\_uuid="
            in body[1]["text"]
        )
        assert (
            f"{self.project.slug} | [Notification Settings](http://testserver/settings/account/notifications/workflow/?referrer=unassigned\\_activity-msteams-user&amp;notification\\_uuid={notification_uuid})"
            == body[3]["columns"][1]["items"][0]["text"]
        )
