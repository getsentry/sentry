from unittest.mock import MagicMock, Mock, patch

from sentry.models import Activity
from sentry.notifications.notifications.activity import RegressionActivityNotification
from sentry.testutils.cases import MSTeamsActivityNotificationTest
from sentry.types.activity import ActivityType


@patch(
    "sentry.integrations.msteams.MsTeamsAbstractClient.get_user_conversation_id",
    Mock(return_value="some_conversation_id"),
)
@patch("sentry.integrations.msteams.MsTeamsAbstractClient.send_card")
class MSTeamsRegressionNotificationTest(MSTeamsActivityNotificationTest):
    def test_regression(self, mock_send_card: MagicMock):
        """
        Test that the card for MS Teams notification is generated correctly when an issue regresses.
        """
        notification = RegressionActivityNotification(
            Activity(
                project=self.project,
                group=self.group,
                user_id=self.user.id,
                type=ActivityType.SET_REGRESSION,
                data={},
            )
        )
        with self.tasks():
            notification.send()

        mock_send_card.assert_called_once()

        args, kwargs = mock_send_card.call_args

        assert args[0] == "some_conversation_id"

        body = args[1]["body"]
        assert 4 == len(body)

        assert "Issue marked as regression" == body[0]["text"]
        assert (
            f"[{self.group.title}](http://testserver/organizations/{self.organization.slug}/issues/{self.group.id}/?referrer=regression\\_activity-msteams)"
            == body[1]["text"]
        )
        assert (
            f"{self.project.slug} | [Notification Settings](http://testserver/settings/account/notifications/workflow/?referrer=regression\\_activity-msteams-user)"
            == body[3]["columns"][1]["items"][0]["text"]
        )
