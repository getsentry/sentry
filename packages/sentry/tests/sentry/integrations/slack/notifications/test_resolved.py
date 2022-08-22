from unittest import mock

import responses

from sentry.models import Activity
from sentry.notifications.notifications.activity import ResolvedActivityNotification
from sentry.testutils.cases import SlackActivityNotificationTest
from sentry.testutils.helpers.slack import get_attachment, send_notification
from sentry.types.activity import ActivityType


class SlackResolvedNotificationTest(SlackActivityNotificationTest):
    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_resolved(self, mock_func):
        """
        Test that a Slack message is sent with the expected payload when an issue is resolved
        """
        notification = ResolvedActivityNotification(
            Activity(
                project=self.project,
                group=self.group,
                user=self.user,
                type=ActivityType.SET_RESOLVED,
                data={"assignee": ""},
            )
        )
        with self.tasks():
            notification.send()

        attachment, text = get_attachment()
        assert (
            text
            == f"{self.name} marked <http://testserver/organizations/{self.organization.slug}/issues/{self.group.id}/?referrer=activity_notification|{self.short_id}> as resolved"
        )
        assert (
            attachment["footer"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=resolved_activity-slack-user|Notification Settings>"
        )
