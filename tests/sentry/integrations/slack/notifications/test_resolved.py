from unittest import mock

import responses

from sentry.models.activity import Activity
from sentry.notifications.notifications.activity.resolved import ResolvedActivityNotification
from sentry.testutils.cases import PerformanceIssueTestCase, SlackActivityNotificationTest
from sentry.testutils.helpers.notifications import TEST_ISSUE_OCCURRENCE, TEST_PERF_ISSUE_OCCURRENCE
from sentry.testutils.helpers.slack import get_attachment
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType

pytestmark = [requires_snuba]


class SlackResolvedNotificationTest(SlackActivityNotificationTest, PerformanceIssueTestCase):
    def create_notification(self, group):
        return ResolvedActivityNotification(
            Activity(
                project=self.project,
                group=group,
                user_id=self.user.id,
                type=ActivityType.SET_RESOLVED,
                data={"assignee": ""},
            )
        )

    @responses.activate
    def test_resolved(self):
        """
        Test that a Slack message is sent with the expected payload when an issue is resolved
        """
        with self.tasks():
            self.create_notification(self.group).send()

        attachment, text = get_attachment()
        notification_uuid = self.get_notification_uuid(attachment["title_link"])
        assert (
            text
            == f"{self.name} marked <http://testserver/organizations/{self.organization.slug}/issues/{self.group.id}/?referrer=activity_notification&notification_uuid={notification_uuid}|{self.short_id}> as resolved"
        )
        assert (
            attachment["footer"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=resolved_activity-slack-user&notification_uuid={notification_uuid}|Notification Settings>"
        )

    @responses.activate
    @mock.patch(
        "sentry.eventstore.models.GroupEvent.occurrence",
        return_value=TEST_PERF_ISSUE_OCCURRENCE,
        new_callable=mock.PropertyMock,
    )
    def test_resolved_performance_issue(self, occurrence):
        """
        Test that a Slack message is sent with the expected payload when a performance issue is resolved
        """
        event = self.create_performance_issue()
        with self.tasks():
            self.create_notification(event.group).send()

        attachment, text = get_attachment()
        notification_uuid = self.get_notification_uuid(attachment["title_link"])
        assert (
            text
            == f"{self.name} marked <http://testserver/organizations/{self.organization.slug}/issues/{event.group.id}/?referrer=activity_notification&notification_uuid={notification_uuid}|{self.project.slug.upper()}-{event.group.short_id}> as resolved"
        )
        self.assert_performance_issue_attachments(
            attachment, self.project.slug, "resolved_activity-slack-user"
        )

    @responses.activate
    @mock.patch(
        "sentry.eventstore.models.GroupEvent.occurrence",
        return_value=TEST_ISSUE_OCCURRENCE,
        new_callable=mock.PropertyMock,
    )
    def test_resolved_generic_issue(self, occurrence):
        """
        Test that a Slack message is sent with the expected payload when a generic issue type is resolved
        """
        event = self.store_event(
            data={"message": "Hellboy's world", "level": "error"}, project_id=self.project.id
        )
        group_event = event.for_group(event.groups[0])
        with self.tasks():
            self.create_notification(group_event.group).send()

        attachment, text = get_attachment()
        notification_uuid = self.get_notification_uuid(attachment["title_link"])
        assert (
            text
            == f"{self.name} marked <http://testserver/organizations/{self.organization.slug}/issues/{group_event.group.id}/?referrer=activity_notification&notification_uuid={notification_uuid}|{self.project.slug.upper()}-{group_event.group.short_id}> as resolved"
        )
        self.assert_generic_issue_attachments(
            attachment, self.project.slug, "resolved_activity-slack-user"
        )
