from unittest import mock

import responses

from sentry.models import Activity
from sentry.notifications.notifications.activity import UnassignedActivityNotification
from sentry.testutils.cases import PerformanceIssueTestCase, SlackActivityNotificationTest
from sentry.testutils.helpers.notifications import TEST_ISSUE_OCCURRENCE
from sentry.testutils.helpers.slack import get_attachment, send_notification
from sentry.types.activity import ActivityType


class SlackUnassignedNotificationTest(SlackActivityNotificationTest, PerformanceIssueTestCase):
    def create_notification(self, group):
        return UnassignedActivityNotification(
            Activity(
                project=self.project,
                group=group,
                user_id=self.user.id,
                type=ActivityType.ASSIGNED,
                data={"assignee": ""},
            )
        )

    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_unassignment(self, mock_func):
        """
        Test that a Slack message is sent with the expected payload when an issue is unassigned
        """
        with self.tasks():
            self.create_notification(self.group).send()

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
        with self.tasks():
            self.create_notification(event.group).send()

        attachment, text = get_attachment()
        assert text == f"Issue unassigned by {self.name}"
        self.assert_performance_issue_attachments(
            attachment, self.project.slug, "unassigned_activity-slack-user"
        )

    @responses.activate
    @mock.patch(
        "sentry.eventstore.models.GroupEvent.occurrence",
        return_value=TEST_ISSUE_OCCURRENCE,
        new_callable=mock.PropertyMock,
    )
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_unassignment_generic_issue(self, mock_func, occurrence):
        """
        Test that a Slack message is sent with the expected payload when a generic issue type is unassigned
        """
        event = self.store_event(
            data={"message": "Hellboy's world", "level": "error"}, project_id=self.project.id
        )
        event = event.for_group(event.groups[0])
        with self.tasks():
            self.create_notification(event.group).send()

        attachment, text = get_attachment()
        assert text == f"Issue unassigned by {self.name}"
        self.assert_generic_issue_attachments(
            attachment, self.project.slug, "unassigned_activity-slack-user"
        )
