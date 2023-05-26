from unittest import mock

import responses

from sentry.models import Activity
from sentry.notifications.notifications.activity import EscalatingActivityNotification
from sentry.testutils.cases import PerformanceIssueTestCase, SlackActivityNotificationTest
from sentry.testutils.helpers.notifications import TEST_ISSUE_OCCURRENCE, TEST_PERF_ISSUE_OCCURRENCE
from sentry.testutils.helpers.slack import get_attachment, send_notification
from sentry.types.activity import ActivityType


class SlackRegressionNotificationTest(SlackActivityNotificationTest, PerformanceIssueTestCase):
    def create_notification(self, group):
        return EscalatingActivityNotification(
            Activity(
                project=self.project,
                group=group,
                user_id=self.user.id,
                type=ActivityType.SET_ESCALATING,
                data={"forecast": 100},
            )
        )

    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_escalating(self, mock_func):
        """
        Test that a Slack message is sent with the expected payload when an issue escalates
        """
        with self.tasks():
            self.create_notification(self.group).send()

        attachment, text = get_attachment()
        assert text == "Issue marked as escalating"
        assert attachment["title"] == "こんにちは"
        assert (
            attachment["text"]
            == "Sentry flagged this issue as escalating because over 100 events happened in an hour"
        )
        assert (
            attachment["footer"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=escalating_activity-slack-user|Notification Settings>"
        )

    @responses.activate
    @mock.patch(
        "sentry.eventstore.models.GroupEvent.occurrence",
        return_value=TEST_PERF_ISSUE_OCCURRENCE,
        new_callable=mock.PropertyMock,
    )
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_escalating_performance_issue(self, mock_func, occurrence):
        """
        Test that a Slack message is sent with the expected payload when a performance issue escalates
        """
        event = self.create_performance_issue()
        with self.tasks():
            self.create_notification(event.group).send()

        attachment, text = get_attachment()
        assert text == "Issue marked as escalating"
        assert attachment["title"] == "N+1 Query"
        assert (
            attachment["title_link"]
            == f"http://testserver/organizations/{self.organization.slug}/issues/{event.group.id}/?referrer=escalating_activity-slack"
        )
        assert (
            attachment["text"]
            == "Sentry flagged this issue as escalating because over 100 events happened in an hour"
        )
        assert (
            attachment["footer"]
            == f"{self.project.slug} | production | <http://testserver/settings/account/notifications/workflow/?referrer=escalating_activity-slack-user|Notification Settings>"
        )

    @responses.activate
    @mock.patch(
        "sentry.eventstore.models.GroupEvent.occurrence",
        return_value=TEST_ISSUE_OCCURRENCE,
        new_callable=mock.PropertyMock,
    )
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_escalating_generic_issue(self, mock_func, occurrence):
        """
        Test that a Slack message is sent with the expected payload when a generic issue type escalates
        """
        event = self.store_event(
            data={"message": "Hellboy's world", "level": "error"}, project_id=self.project.id
        )
        event = event.for_group(event.groups[0])

        with self.tasks():
            self.create_notification(event.group).send()

        attachment, text = get_attachment()
        assert text == "Issue marked as escalating"
        assert attachment["title"] == TEST_ISSUE_OCCURRENCE.issue_title
        assert (
            attachment["title_link"]
            == f"http://testserver/organizations/{self.organization.slug}/issues/{event.group.id}/?referrer=escalating_activity-slack"
        )
        assert (
            attachment["text"]
            == "Sentry flagged this issue as escalating because over 100 events happened in an hour"
        )
        assert (
            attachment["footer"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=escalating_activity-slack-user|Notification Settings>"
        )
