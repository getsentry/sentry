from unittest import mock

import responses

from sentry.models import Activity
from sentry.notifications.notifications.activity import NoteActivityNotification
from sentry.testutils.cases import SlackActivityNotificationTest
from sentry.testutils.helpers.slack import get_attachment, send_notification
from sentry.types.activity import ActivityType


class SlackNoteNotificationTest(SlackActivityNotificationTest):
    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_note(self, mock_func):
        """
        Test that a Slack message is sent with the expected payload when a comment is made on an issue
        """
        notification = NoteActivityNotification(
            Activity(
                project=self.project,
                group=self.group,
                user=self.user,
                type=ActivityType.NOTE,
                data={"text": "text", "mentions": []},
            )
        )
        with self.tasks():
            notification.send()

        attachment, text = get_attachment()

        assert text == f"New comment by {self.name} on {self.group.qualified_short_id}"
        assert attachment["title"] == f"{self.group.title}"
        assert (
            attachment["title_link"]
            == f"http://testserver/organizations/{self.organization.slug}/issues/{self.group.id}/?referrer=note_activity-slack"
        )
        assert attachment["text"] == notification.activity.data["text"]
        assert (
            attachment["footer"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=note_activity-slack-user|Notification Settings>"
        )
