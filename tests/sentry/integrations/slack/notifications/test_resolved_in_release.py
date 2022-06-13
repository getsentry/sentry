from unittest import mock

import responses
from sentry_relay import parse_release

from sentry.models import Activity
from sentry.notifications.notifications.activity import ResolvedInReleaseActivityNotification
from sentry.testutils.cases import SlackActivityNotificationTest
from sentry.testutils.helpers.slack import get_attachment, send_notification
from sentry.types.activity import ActivityType


class SlackResolvedInReleaseNotificationTest(SlackActivityNotificationTest):
    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_resolved_in_release(self, mock_func):
        """
        Test that a Slack message is sent with the expected payload when an issue is resolved in a release
        """
        notification = ResolvedInReleaseActivityNotification(
            Activity(
                project=self.project,
                group=self.group,
                user=self.user,
                type=ActivityType.SET_RESOLVED_IN_RELEASE,
                data={"version": "meow"},
            )
        )
        with self.tasks():
            notification.send()

        attachment, text = get_attachment()
        version_parsed = parse_release(notification.activity.data["version"])["description"]

        test_issue_url = f"http://testserver/organizations/{self.organization.slug}/issues/{self.group.id}/?referrer=activity_notification"

        assert (
            text
            == f"{self.user.username} marked <{test_issue_url}|{self.group.qualified_short_id}> as resolved in {version_parsed}"
        )
        assert (
            attachment["footer"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=resolved_in_release_activity-slack-user|Notification Settings>"
        )

    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_resolved_in_release_without_version(self, mock_func):
        """
        Test that a Slack message is sent with the expected payload when an issue is resolved in a release
        """
        notification = ResolvedInReleaseActivityNotification(
            Activity(
                project=self.project,
                group=self.group,
                user=self.user,
                type=ActivityType.SET_RESOLVED_IN_RELEASE,
                data={},
            )
        )
        with self.tasks():
            notification.send()

        attachment, text = get_attachment()

        test_issue_url = f"http://testserver/organizations/{self.organization.slug}/issues/{self.group.id}/?referrer=activity_notification"

        assert (
            text
            == f"{self.user.username} marked <{test_issue_url}|{self.group.qualified_short_id}> as resolved in an upcoming release"
        )
        assert (
            attachment["footer"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=resolved_in_release_activity-slack-user|Notification Settings>"
        )
