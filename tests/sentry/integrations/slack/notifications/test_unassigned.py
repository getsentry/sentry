from unittest import mock

import responses

from sentry.models import Activity
from sentry.notifications.notifications.activity import UnassignedActivityNotification
from sentry.testutils.cases import PerformanceIssueTestCase, SlackActivityNotificationTest
from sentry.testutils.helpers.slack import get_attachment, send_notification
from sentry.types.activity import ActivityType


class SlackUnassignedNotificationTest(SlackActivityNotificationTest, PerformanceIssueTestCase):
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
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=unassigned_activity-slack-user|Notification Settings>"
        )

    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_unassignment_performance_issue(self, mock_func):
        """
        Test that a Slack message is sent with the expected payload when a performance issue is unassigned
        """
        event = self.create_performance_issue()
        notification = UnassignedActivityNotification(
            Activity(
                project=self.project,
                group=event.group,
                user=self.user,
                type=ActivityType.ASSIGNED,
                data={"assignee": ""},
            )
        )
        with self.feature("organizations:performance-issues"), self.tasks():
            notification.send()

        attachment, text = get_attachment()
        assert text == f"Issue unassigned by {self.name}"
        assert attachment["title"] == "N+1 Query"
        assert (
            attachment["text"]
            == "db - SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21"
        )
        assert (
            attachment["footer"]
            == f"{self.project.slug} | production | <http://testserver/settings/account/notifications/workflow/?referrer=unassigned_activity-slack-user|Notification Settings>"
        )
