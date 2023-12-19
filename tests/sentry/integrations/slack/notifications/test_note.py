from unittest import mock

import responses

from sentry.models.activity import Activity
from sentry.notifications.notifications.activity.note import NoteActivityNotification
from sentry.testutils.cases import PerformanceIssueTestCase, SlackActivityNotificationTest
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.notifications import TEST_ISSUE_OCCURRENCE
from sentry.testutils.helpers.slack import get_attachment, get_blocks_and_fallback_text
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
    def test_note(self):
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
    @with_feature("organizations:slack-block-kit")
    def test_note_block(self):
        """
        Tests that a Slack message is sent with the expected payload when a comment is made on an issue
        with block kit enabled.
        """
        notification = self.create_notification(self.group)
        with self.tasks():
            notification.send()

        blocks, fallback_text = get_blocks_and_fallback_text()

        assert fallback_text == f"New comment by {self.name}"
        assert blocks[0]["text"]["text"] == fallback_text
        notification_uuid = self.get_notification_uuid(blocks[1]["text"]["text"])
        comment = notification.activity.data["text"]
        assert (
            blocks[1]["text"]["text"]
            == f"<http://testserver/organizations/{self.organization.slug}/issues/{self.group.id}/?referrer=note_activity-slack&notification_uuid={notification_uuid}|*{self.group.title}*>  \n{comment}"
        )
        assert (
            blocks[2]["elements"][0]["text"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=note_activity-slack-user&notification_uuid={notification_uuid}|Notification Settings>"
        )

    @responses.activate
    def test_note_performance_issue(self):
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
    @with_feature("organizations:slack-block-kit")
    def test_note_performance_issue_block(self):
        """
        Tests that a Slack message is sent with the expected payload when a comment is made on a performance issue
        with block kit enabled.
        """
        event = self.create_performance_issue()
        notification = self.create_notification(event.group)

        with self.tasks():
            notification.send()

        blocks, fallback_text = get_blocks_and_fallback_text()
        assert fallback_text == f"New comment by {self.name}"
        assert blocks[0]["text"]["text"] == fallback_text
        notification_uuid = self.get_notification_uuid(blocks[1]["text"]["text"])
        comment = notification.activity.data["text"]
        assert (
            blocks[1]["text"]["text"]
            == f"<http://testserver/organizations/{self.organization.slug}/issues/{event.group.id}/?referrer=note_activity-slack&notification_uuid={notification_uuid}|*N+1 Query*>  \n{comment}"
        )
        assert (
            blocks[2]["elements"][0]["text"]
            == f"{self.project.slug} | production | <http://testserver/settings/account/notifications/workflow/?referrer=note_activity-slack-user&notification_uuid={notification_uuid}|Notification Settings>"
        )

    @responses.activate
    @mock.patch(
        "sentry.eventstore.models.GroupEvent.occurrence",
        return_value=TEST_ISSUE_OCCURRENCE,
        new_callable=mock.PropertyMock,
    )
    def test_note_generic_issue(self, occurrence):
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

    @responses.activate
    @mock.patch(
        "sentry.eventstore.models.GroupEvent.occurrence",
        return_value=TEST_ISSUE_OCCURRENCE,
        new_callable=mock.PropertyMock,
    )
    @with_feature("organizations:slack-block-kit")
    def test_note_generic_issue_block(self, occurrence):
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

        blocks, fallback_text = get_blocks_and_fallback_text()
        assert fallback_text == f"New comment by {self.name}"
        assert blocks[0]["text"]["text"] == fallback_text
        notification_uuid = self.get_notification_uuid(blocks[1]["text"]["text"])
        comment = notification.activity.data["text"]
        assert event.group
        assert (
            blocks[1]["text"]["text"]
            == f"<http://testserver/organizations/{self.organization.slug}/issues/{event.group.id}/?referrer=note_activity-slack&notification_uuid={notification_uuid}|*{TEST_ISSUE_OCCURRENCE.issue_title}*>  \n{comment}"
        )
        assert (
            blocks[2]["elements"][0]["text"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=note_activity-slack-user&notification_uuid={notification_uuid}|Notification Settings>"
        )
