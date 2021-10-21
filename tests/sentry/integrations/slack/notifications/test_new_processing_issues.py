import responses

from sentry.models import Activity
from sentry.notifications.notifications.activity import NewProcessingIssuesActivityNotification
from sentry.types.activity import ActivityType
from sentry.utils.compat import mock

from . import SlackActivityNotificationTest, get_attachment, send_notification


class SlackUnassignedNotificationTest(SlackActivityNotificationTest):
    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_new_processing_issue(self, mock_func):
        """
        Test that a Slack message is sent with the expected payload when an issue is held back in reprocessing
        """
        data = [
            {
                "data": {
                    "image_arch": "arm64",
                    "image_path": "/var/containers/Bundle/Application/FB14D416-DE4E-4224-9789-6B88E9C42601/CrashProbeiOS.app/CrashProbeiOS",
                    "image_uuid": "a2df1794-e0c7-371c-baa4-93eac340a78a",
                },
                "object": "dsym:a2df1794-e0c7-371c-baa4-93eac340a78a",
                "scope": "native",
                "type": "native_missing_dsym",
            },
            {
                "data": {
                    "image_arch": "arm64",
                    "image_path": "/var/containers/Bundle/Application/FB14D416-DE4E-4224-9789-6B88E9C42601/CrashProbeiOS.app/libCrashProbeiOS",
                    "image_uuid": "12dc1b4c-a01b-463f-ae88-5cf0c31ae680",
                },
                "object": "dsym:12dc1b4c-a01b-463f-ae88-5cf0c31ae680",
                "scope": "native",
                "type": "native_bad_dsym",
            },
        ]
        notification = NewProcessingIssuesActivityNotification(
            Activity(
                project=self.project,
                user=self.user,
                type=ActivityType.NEW_PROCESSING_ISSUES,
                data={
                    "issues": data,
                    "reprocessing_active": True,
                },
            )
        )
        with self.tasks():
            notification.send()

        attachment, text = get_attachment()
        assert (
            text
            == f"Processing issues on <{self.project.slug}|http://testserver/settings/{self.organization.slug}/projects/{self.project.slug}/processing-issues/"
        )
        assert (
            attachment["text"]
            == f"Some events failed to process in your project {self.project.slug}"
        )
        assert (
            attachment["footer"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=NewProcessingIssuesActivitySlackUser|Notification Settings>"
        )
