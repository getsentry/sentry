from unittest.mock import MagicMock, Mock, patch

from sentry.models import Activity
from sentry.notifications.notifications.activity import NoteActivityNotification
from sentry.testutils.cases import MSTeamsActivityNotificationTest
from sentry.types.activity import ActivityType


@patch(
    "sentry.integrations.msteams.MsTeamsAbstractClient.get_user_conversation_id",
    Mock(return_value="some_conversation_id"),
)
@patch("sentry.integrations.msteams.MsTeamsAbstractClient.send_card")
class MSTeamsNoteNotificationTest(MSTeamsActivityNotificationTest):
    def test_note(self, mock_send_card: MagicMock):
        """
        Test that the card for MS Teams notification is generated correctly when a comment is made on an issue.
        """
        notification = NoteActivityNotification(
            Activity(
                project=self.project,
                group=self.group,
                user_id=self.user.id,
                type=ActivityType.NOTE,
                data={"text": "text", "mentions": []},
            )
        )
        with self.tasks():
            notification.send()

        mock_send_card.assert_called_once()

        args, kwargs = mock_send_card.call_args

        assert args[0] == "some_conversation_id"

        body = args[1]["body"]
        assert 4 == len(body)

        assert f"New comment by {self.user.get_display_name()}" == body[0]["text"]
        assert (
            f"[{self.group.title}](http://testserver/organizations/{self.organization.slug}/issues/{self.group.id}/?referrer=note\\_activity-msteams)"
            == body[1]["text"]
        )
        assert notification.activity.data["text"] == body[2]["text"]
        assert (
            f"{self.project.slug} | [Notification Settings](http://testserver/settings/account/notifications/workflow/?referrer=note\\_activity-msteams-user)"
            == body[3]["columns"][1]["items"][0]["text"]
        )
