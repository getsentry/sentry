import responses

from sentry.models import Activity
from sentry.notifications.notifications.activity import RegressionActivityNotification
from sentry.types.activity import ActivityType
from sentry.utils.compat import mock

from . import SlackActivityNotificationTest, get_attachment, send_notification


class SlackUnassignedNotificationTest(SlackActivityNotificationTest):
    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_regression(self, mock_func):
        """
        Test that a Slack message is sent with the expected payload when an issue regresses
        """
        notification = RegressionActivityNotification(
            Activity(
                project=self.project,
                group=self.group,
                user=self.user,
                type=ActivityType.SET_REGRESSION,
                data={},
            )
        )
        with self.tasks():
            notification.send()

        attachment, text = get_attachment()
        assert text == "Issue marked as regression"
        assert (
            attachment["footer"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=RegressionActivitySlackUser|Notification Settings>"
        )
