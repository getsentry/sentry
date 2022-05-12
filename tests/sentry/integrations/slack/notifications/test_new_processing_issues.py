from unittest import mock

import responses

from sentry.models import Activity
from sentry.notifications.notifications.activity import NewProcessingIssuesActivityNotification
from sentry.testutils.cases import SlackActivityNotificationTest
from sentry.testutils.helpers.slack import get_attachment, send_notification
from sentry.types.activity import ActivityType
from sentry.web.frontend.debug.debug_new_processing_issues_email import get_issues_data


class SlackNewProcessingIssuesNotificationTest(SlackActivityNotificationTest):
    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_new_processing_issue(self, mock_func):
        """
        Test that a Slack message is sent with the expected payload when an issue is held back in reprocessing
        """

        notification = NewProcessingIssuesActivityNotification(
            Activity(
                project=self.project,
                user=self.user,
                type=ActivityType.NEW_PROCESSING_ISSUES,
                data={
                    "issues": get_issues_data(),
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
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=new_processing_issues_activity-slack-user|Notification Settings>"
        )
