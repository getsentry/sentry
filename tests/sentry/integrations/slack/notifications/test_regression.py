from unittest import mock

import responses

from sentry.models import Activity
from sentry.notifications.notifications.activity import RegressionActivityNotification
from sentry.testutils.cases import PerformanceIssueTestCase, SlackActivityNotificationTest
from sentry.testutils.helpers.notifications import TEST_ISSUE_OCCURRENCE
from sentry.testutils.helpers.slack import get_attachment, send_notification
from sentry.types.activity import ActivityType


class SlackRegressionNotificationTest(SlackActivityNotificationTest, PerformanceIssueTestCase):
    def create_notification(self, group):
        return RegressionActivityNotification(
            Activity(
                project=self.project,
                group=group,
                user_id=self.user.id,
                type=ActivityType.SET_REGRESSION,
                data={},
            )
        )

    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_regression(self, mock_func):
        """
        Test that a Slack message is sent with the expected payload when an issue regresses
        """
        with self.tasks():
            self.create_notification(self.group).send()

        attachment, text = get_attachment()
        assert text == "Issue marked as regression"
        assert attachment["title"] == "こんにちは"
        assert attachment["text"] == ""
        assert (
            attachment["footer"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=regression_activity-slack-user|Notification Settings>"
        )

    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_regression_performance_issue(self, mock_func):
        """
        Test that a Slack message is sent with the expected payload when a performance issue regresses
        """
        event = self.create_performance_issue()
        with self.tasks():
            self.create_notification(event.group).send()

        attachment, text = get_attachment()
        assert text == "Issue marked as regression"
        self.assert_performance_issue_attachments(
            attachment, self.project.slug, "regression_activity-slack-user"
        )

    @responses.activate
    @mock.patch(
        "sentry.eventstore.models.GroupEvent.occurrence",
        return_value=TEST_ISSUE_OCCURRENCE,
        new_callable=mock.PropertyMock,
    )
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_regression_generic_issue(self, mock_func, occurrence):
        """
        Test that a Slack message is sent with the expected payload when a generic issue type regresses
        """
        event = self.store_event(
            data={"message": "Hellboy's world", "level": "error"}, project_id=self.project.id
        )
        event = event.for_group(event.groups[0])

        with self.tasks():
            self.create_notification(event.group).send()

        attachment, text = get_attachment()
        assert text == "Issue marked as regression"
        self.assert_generic_issue_attachments(
            attachment, self.project.slug, "regression_activity-slack-user"
        )
