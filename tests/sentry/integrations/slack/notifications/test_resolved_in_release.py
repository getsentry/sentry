from unittest import mock

import responses

from sentry.models import Activity
from sentry.notifications.notifications.activity import ResolvedInReleaseActivityNotification
from sentry.testutils.cases import PerformanceIssueTestCase, SlackActivityNotificationTest
from sentry.testutils.helpers.notifications import TEST_ISSUE_OCCURRENCE
from sentry.testutils.helpers.slack import get_attachment, send_notification
from sentry.types.activity import ActivityType


class SlackResolvedInReleaseNotificationTest(
    SlackActivityNotificationTest, PerformanceIssueTestCase
):
    def create_notification(self, group):
        return ResolvedInReleaseActivityNotification(
            Activity(
                project=self.project,
                group=group,
                user_id=self.user.id,
                type=ActivityType.SET_RESOLVED_IN_RELEASE,
                data={"version": "meow"},
            )
        )

    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_resolved_in_release(self, mock_func):
        """
        Test that a Slack message is sent with the expected payload when an issue is resolved in a release
        """
        notification = self.create_notification(self.group)
        with self.tasks():
            notification.send()

        attachment, text = get_attachment()
        release_name = notification.activity.data["version"]
        assert text == f"Issue marked as resolved in {release_name} by {self.name}"
        assert (
            attachment["footer"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=resolved_in_release_activity-slack-user|Notification Settings>"
        )

    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_resolved_in_release_performance_issue(self, mock_func):
        """
        Test that a Slack message is sent with the expected payload when a performance issue is resolved in a release
        """
        event = self.create_performance_issue()
        notification = self.create_notification(event.group)
        with self.tasks():
            notification.send()

        attachment, text = get_attachment()
        release_name = notification.activity.data["version"]
        assert text == f"Issue marked as resolved in {release_name} by {self.name}"
        self.assert_performance_issue_attachments(
            attachment, self.project.slug, "resolved_in_release_activity-slack-user"
        )

    @responses.activate
    @mock.patch(
        "sentry.eventstore.models.GroupEvent.occurrence",
        return_value=TEST_ISSUE_OCCURRENCE,
        new_callable=mock.PropertyMock,
    )
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_resolved_in_release_generic_issue(self, mock_func, occurrence):
        """
        Test that a Slack message is sent with the expected payload when a generic issue type is resolved in a release
        """
        event = self.store_event(
            data={"message": "Hellboy's world", "level": "error"}, project_id=self.project.id
        )
        event = event.for_group(event.groups[0])
        notification = self.create_notification(event.group)
        with self.tasks():
            notification.send()

        attachment, text = get_attachment()
        release_name = notification.activity.data["version"]
        assert text == f"Issue marked as resolved in {release_name} by {self.name}"
        self.assert_generic_issue_attachments(
            attachment, self.project.slug, "resolved_in_release_activity-slack-user"
        )
