from unittest import mock

import responses

from sentry.models.activity import Activity
from sentry.notifications.notifications.activity.note import NoteActivityNotification
from sentry.testutils.cases import PerformanceIssueTestCase, SlackActivityNotificationTest
from sentry.testutils.helpers.notifications import TEST_ISSUE_OCCURRENCE
from sentry.testutils.helpers.slack import get_attachment, send_notification
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType

pytestmark = [requires_snuba]


class SlackNoteNotificationTest(SlackActivityNotificationTest, PerformanceIssueTestCase):
    def create_notification(self, group):
        return NoteActivityNotification(
            Activity(
                project=self.project,
                group=group,
                user_id=self.user.id,
                type=ActivityType.NOTE,
                data={"text": "text", "mentions": []},
            )
        )

    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_note(self, mock_func):
        """
        Test that a Slack message is sent with the expected payload when a comment is made on an issue
        """
        notification = self.create_notification(self.group)
        with self.tasks():
            notification.send()

        attachment, text = get_attachment()

        assert text == f"New comment by {self.name}"
        assert attachment["title"] == f"{self.group.title}"
        notification_uuid = self.get_notification_uuid(attachment["title_link"])
        assert (
            attachment["title_link"]
            == f"http://testserver/organizations/{self.organization.slug}/issues/{self.group.id}/?referrer=note_activity-slack&notification_uuid={notification_uuid}"
        )
        assert attachment["text"] == notification.activity.data["text"]
        assert (
            attachment["footer"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=note_activity-slack-user&notification_uuid={notification_uuid}|Notification Settings>"
        )

    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_note_performance_issue(self, mock_func):
        """
        Test that a Slack message is sent with the expected payload when a comment is made on a performance issue
        """
        event = self.create_performance_issue()
        notification = self.create_notification(event.group)

        with self.tasks():
            notification.send()

        attachment, text = get_attachment()
        assert text == f"New comment by {self.name}"
        assert attachment["title"] == "N+1 Query"
        notification_uuid = self.get_notification_uuid(attachment["title_link"])
        assert (
            attachment["title_link"]
            == f"http://testserver/organizations/{self.organization.slug}/issues/{event.group.id}/?referrer=note_activity-slack&notification_uuid={notification_uuid}"
        )
        assert attachment["text"] == notification.activity.data["text"]
        assert (
            attachment["footer"]
            == f"{self.project.slug} | production | <http://testserver/settings/account/notifications/workflow/?referrer=note_activity-slack-user&notification_uuid={notification_uuid}|Notification Settings>"
        )

    @responses.activate
    @mock.patch(
        "sentry.eventstore.models.GroupEvent.occurrence",
        return_value=TEST_ISSUE_OCCURRENCE,
        new_callable=mock.PropertyMock,
    )
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_note_generic_issue(self, mock_func, occurrence):
        """
        Test that a Slack message is sent with the expected payload when a comment is made on a generic issue type
        """
        event = self.store_event(
            data={"message": "Hellboy's world", "level": "error"}, project_id=self.project.id
        )
        group_event = event.for_group(event.groups[0])
        notification = self.create_notification(group_event.group)

        with self.tasks():
            notification.send()

        attachment, text = get_attachment()
        assert text == f"New comment by {self.name}"
        assert attachment["title"] == TEST_ISSUE_OCCURRENCE.issue_title
        assert attachment["text"] == notification.activity.data["text"]
        notification_uuid = self.get_notification_uuid(attachment["title_link"])
        assert (
            attachment["footer"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=note_activity-slack-user&notification_uuid={notification_uuid}|Notification Settings>"
        )
