from unittest import mock

import responses

from sentry.models import Activity
from sentry.notifications.notifications.activity import UnassignedActivityNotification
from sentry.testutils.cases import SlackActivityNotificationTest
from sentry.testutils.helpers.slack import get_attachment, send_notification
from sentry.types.activity import ActivityType


class SlackUnassignedNotificationTest(SlackActivityNotificationTest):
    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_unassignment(self, mock_func):
        """
        Test that a Slack message is sent with the expected payload when an issue is unassigned
        """
        notification = UnassignedActivityNotification(
            Activity(
                project=self.project,
                group=self.group,
                user=self.user,
                type=ActivityType.ASSIGNED,
                data={"assignee": ""},
            )
        )
        with self.tasks():
            notification.send()

        attachment, text = get_attachment()
        assert text == f"Issue unassigned by {self.name}"
        assert attachment["title"] == self.group.title
        assert (
            attachment["footer"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=unassigned-activity-slack-user|Notification Settings>"
        )
