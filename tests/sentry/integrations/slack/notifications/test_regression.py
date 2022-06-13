from unittest import mock

import responses
from sentry_relay import parse_release

from sentry.models import Activity
from sentry.notifications.notifications.activity import RegressionActivityNotification
from sentry.testutils.cases import SlackActivityNotificationTest
from sentry.testutils.helpers.slack import get_attachment, send_notification
from sentry.types.activity import ActivityType


class SlackRegressionNotificationTest(SlackActivityNotificationTest):
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

        assert (
            text
            == f"{self.user.username} marked <{self.get_issue_url()}|{self.group.qualified_short_id}> as a regression"
        )
        assert (
            attachment["footer"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=regression_activity-slack-user|Notification Settings>"
        )

    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_regression_with_version(self, mock_func):
        """
        Test that a Slack message is sent with the expected payload when an issue regresses in version
        """
        notification = RegressionActivityNotification(
            Activity(
                project=self.project,
                group=self.group,
                user=self.user,
                type=ActivityType.SET_REGRESSION,
                data={"version": "meow"},
            )
        )
        with self.tasks():
            notification.send()

        attachment, text = get_attachment()

        version_parsed = parse_release(notification.activity.data["version"])["description"]

        assert (
            text
            == f"{self.user.username} marked <{self.get_issue_url()}|{self.group.qualified_short_id}> as a regression in {version_parsed}"
        )
        assert (
            attachment["footer"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=regression_activity-slack-user|Notification Settings>"
        )
