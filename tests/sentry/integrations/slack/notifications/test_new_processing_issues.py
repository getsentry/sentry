import responses

from sentry.models.activity import Activity
from sentry.notifications.notifications.activity.new_processing_issues import (
    NewProcessingIssuesActivityNotification,
)
from sentry.testutils.cases import SlackActivityNotificationTest
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.slack import get_blocks_and_fallback_text
from sentry.types.activity import ActivityType
from sentry.web.frontend.debug.debug_new_processing_issues_email import get_issues_data


class SlackNewProcessingIssuesNotificationTest(SlackActivityNotificationTest):
    @responses.activate
    def test_new_processing_issue_block(self):
        """
        Test that a Slack message is sent with the expected payload when an issue is held back in reprocessing
        and block kit is enabled.
        """
        notification = NewProcessingIssuesActivityNotification(
            Activity(
                project=self.project,
                user_id=self.user.id,
                type=ActivityType.NEW_PROCESSING_ISSUES,
                data={
                    "issues": get_issues_data(),
                    "reprocessing_active": True,
                },
            )
        )

        with self.tasks():
            notification.send()

        blocks, fallback_text = get_blocks_and_fallback_text()
        notification_uuid = self.get_notification_uuid(blocks[0]["text"]["text"])
        assert (
            fallback_text
            == f"Processing issues on <http://testserver/settings/{self.organization.slug}/projects/{self.project.slug}/processing-issues/?referrer=new_processing_issues_activity&notification_uuid={notification_uuid}|{self.project.slug}>"
        )
        assert blocks[0]["text"]["text"] == fallback_text
        assert (
            blocks[1]["text"]["text"]
            == f"*Processing Issues on {self.project.slug}*  \nSome events failed to process in your project {self.project.slug}"
        )
        assert (
            blocks[2]["elements"][0]["text"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=new_processing_issues_activity-slack-user&notification_uuid={notification_uuid}&organizationId={self.organization.id}|Notification Settings>"
        )

    @responses.activate
    @with_feature("organizations:customer-domains")
    def test_new_processing_issue_customer_domains_block(self):
        notification = NewProcessingIssuesActivityNotification(
            Activity(
                project=self.project,
                user_id=self.user.id,
                type=ActivityType.NEW_PROCESSING_ISSUES,
                data={
                    "issues": get_issues_data(),
                    "reprocessing_active": True,
                },
            )
        )

        with self.tasks():
            notification.send()

        blocks, fallback_text = get_blocks_and_fallback_text()
        notification_uuid = self.get_notification_uuid(blocks[0]["text"]["text"])
        assert (
            fallback_text
            == f"Processing issues on <http://{self.organization.slug}.testserver/settings/projects/{self.project.slug}/processing-issues/?referrer=new_processing_issues_activity&notification_uuid={notification_uuid}|{self.project.slug}>"
        )
        assert blocks[0]["text"]["text"] == fallback_text
        assert (
            blocks[1]["text"]["text"]
            == f"*Processing Issues on {self.project.slug}*  \nSome events failed to process in your project {self.project.slug}"
        )
        assert (
            blocks[2]["elements"][0]["text"]
            == f"{self.project.slug} | <http://{self.organization.slug}.testserver/settings/account/notifications/workflow/?referrer=new_processing_issues_activity-slack-user&notification_uuid={notification_uuid}&organizationId={self.organization.id}|Notification Settings>"
        )
