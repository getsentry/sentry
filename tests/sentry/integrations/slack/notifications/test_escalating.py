from unittest import mock

import orjson

from sentry.models.activity import Activity
from sentry.notifications.notifications.activity.escalating import EscalatingActivityNotification
from sentry.testutils.cases import PerformanceIssueTestCase, SlackActivityNotificationTest
from sentry.testutils.helpers.notifications import TEST_ISSUE_OCCURRENCE, TEST_PERF_ISSUE_OCCURRENCE
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType

pytestmark = [requires_snuba]


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

    def test_escalating_block(self):
        """
        Test that a Slack message is sent with the expected payload when an issue escalates
        and block kit is enabled.
        """
        with self.tasks():
            self.create_notification(self.group).send()

        blocks = orjson.loads(self.mock_post.call_args.kwargs["blocks"])
        fallback_text = self.mock_post.call_args.kwargs["text"]

        assert fallback_text == "Issue marked as escalating"
        assert blocks[0]["text"]["text"] == fallback_text
        notification_uuid = self.get_notification_uuid(blocks[1]["text"]["text"])
        assert (
            blocks[1]["text"]["text"]
            == f"<http://testserver/organizations/{self.organization.slug}/issues/{self.group.id}/?referrer=escalating_activity-slack&notification_uuid={notification_uuid}|*{self.group.title}*>  \nSentry flagged this issue as escalating because over 100 events happened in an hour."
        )
        assert (
            blocks[2]["elements"][0]["text"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=escalating_activity-slack-user&notification_uuid={notification_uuid}&organizationId={self.organization.id}|Notification Settings>"
        )

    @mock.patch(
        "sentry.eventstore.models.GroupEvent.occurrence",
        return_value=TEST_PERF_ISSUE_OCCURRENCE,
        new_callable=mock.PropertyMock,
    )
    def test_escalating_performance_issue_block(self, occurrence):
        """
        Test that a Slack message is sent with the expected payload when a performance issue escalates
        and block kit is enabled.
        """
        event = self.create_performance_issue()
        with self.tasks():
            self.create_notification(event.group).send()

        blocks = orjson.loads(self.mock_post.call_args.kwargs["blocks"])
        fallback_text = self.mock_post.call_args.kwargs["text"]

        assert fallback_text == "Issue marked as escalating"
        assert blocks[0]["text"]["text"] == fallback_text
        notification_uuid = self.get_notification_uuid(blocks[1]["text"]["text"])
        assert (
            blocks[1]["text"]["text"]
            == f"<http://testserver/organizations/{self.organization.slug}/issues/{event.group.id}/?referrer=escalating_activity-slack&notification_uuid={notification_uuid}|*{event.group.title}*>  \nSentry flagged this issue as escalating because over 100 events happened in an hour."
        )
        assert (
            blocks[2]["elements"][0]["text"]
            == f"{self.project.slug} | production | <http://testserver/settings/account/notifications/workflow/?referrer=escalating_activity-slack-user&notification_uuid={notification_uuid}&organizationId={self.organization.id}|Notification Settings>"
        )

    @mock.patch(
        "sentry.eventstore.models.GroupEvent.occurrence",
        return_value=TEST_ISSUE_OCCURRENCE,
        new_callable=mock.PropertyMock,
    )
    def test_escalating_generic_issue_block(self, occurrence):
        """
        Test that a Slack message is sent with the expected payload when a generic issue type escalates
        and block kit is enabled.
        """
        event = self.store_event(
            data={"message": "Hellboy's world", "level": "error"}, project_id=self.project.id
        )
        group_event = event.for_group(event.groups[0])

        with self.tasks():
            self.create_notification(group_event.group).send()

        blocks = orjson.loads(self.mock_post.call_args.kwargs["blocks"])
        fallback_text = self.mock_post.call_args.kwargs["text"]

        assert fallback_text == "Issue marked as escalating"
        assert blocks[0]["text"]["text"] == fallback_text
        notification_uuid = self.get_notification_uuid(blocks[1]["text"]["text"])
        assert (
            blocks[1]["text"]["text"]
            == f"<http://testserver/organizations/{self.organization.slug}/issues/{group_event.group.id}/?referrer=escalating_activity-slack&notification_uuid={notification_uuid}|*{TEST_ISSUE_OCCURRENCE.issue_title}*>  \nSentry flagged this issue as escalating because over 100 events happened in an hour."
        )
        assert (
            blocks[2]["elements"][0]["text"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=escalating_activity-slack-user&notification_uuid={notification_uuid}&organizationId={self.organization.id}|Notification Settings>"
        )
