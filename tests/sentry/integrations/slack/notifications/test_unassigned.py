from unittest import mock

import responses

from sentry.models.activity import Activity
from sentry.notifications.notifications.activity.unassigned import UnassignedActivityNotification
from sentry.testutils.cases import PerformanceIssueTestCase, SlackActivityNotificationTest
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.notifications import TEST_ISSUE_OCCURRENCE, TEST_PERF_ISSUE_OCCURRENCE
from sentry.testutils.helpers.slack import get_attachment, get_blocks_and_fallback_text
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType

pytestmark = [requires_snuba]


class SlackUnassignedNotificationTest(SlackActivityNotificationTest, PerformanceIssueTestCase):
    def create_notification(self, group):
        return UnassignedActivityNotification(
            Activity(
                project=self.project,
                group=group,
                user_id=self.user.id,
                type=ActivityType.ASSIGNED,
                data={"assignee": ""},
            )
        )

    @responses.activate
    def test_unassignment(self):
        """
        Test that a Slack message is sent with the expected payload when an issue is unassigned
        """
        with self.tasks():
            self.create_notification(self.group).send()

        attachment, text = get_attachment()
        assert text == f"Issue unassigned by {self.name}"
        assert attachment["title"] == self.group.title
        notification_uuid = self.get_notification_uuid(attachment["title_link"])
        assert (
            attachment["footer"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=unassigned_activity-slack-user&notification_uuid={notification_uuid}|Notification Settings>"
        )

    @responses.activate
    @with_feature("organizations:slack-block-kit")
    def test_unassignment_block(self):
        """
        Test that a Slack message is sent with the expected payload when an issue is unassigned
        and block kit is enabled.
        """
        with self.tasks():
            self.create_notification(self.group).send()

        blocks, fallback_text = get_blocks_and_fallback_text()
        assert fallback_text == f"Issue unassigned by {self.name}"
        assert blocks[0]["text"]["text"] == fallback_text
        notification_uuid = self.get_notification_uuid(blocks[1]["text"]["text"])
        assert blocks[1]["text"]["text"] == (
            f":red_circle: <http://testserver/organizations/{self.organization.slug}/issues/{self.group.id}/?referrer=unassigned_activity-slack&notification_uuid={notification_uuid}|*{self.group.title}*>"
        )
        assert (
            blocks[3]["elements"][0]["text"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=unassigned_activity-slack-user&notification_uuid={notification_uuid}|Notification Settings>"
        )

    @responses.activate
    @mock.patch(
        "sentry.eventstore.models.GroupEvent.occurrence",
        return_value=TEST_PERF_ISSUE_OCCURRENCE,
        new_callable=mock.PropertyMock,
    )
    def test_unassignment_performance_issue(self, occurrence):
        """
        Test that a Slack message is sent with the expected payload when a performance issue is unassigned
        """
        event = self.create_performance_issue()
        with self.tasks():
            self.create_notification(event.group).send()

        attachment, text = get_attachment()
        assert text == f"Issue unassigned by {self.name}"
        self.assert_performance_issue_attachments(
            attachment, self.project.slug, "unassigned_activity-slack-user"
        )

    @responses.activate
    @mock.patch(
        "sentry.eventstore.models.GroupEvent.occurrence",
        return_value=TEST_PERF_ISSUE_OCCURRENCE,
        new_callable=mock.PropertyMock,
    )
    @with_feature("organizations:slack-block-kit")
    def test_unassignment_performance_issue_block(self, occurrence):
        """
        Test that a Slack message is sent with the expected payload when a performance issue is unassigned
        and block kit is enabled.
        """
        event = self.create_performance_issue()
        with self.tasks():
            self.create_notification(event.group).send()

        blocks, fallback_text = get_blocks_and_fallback_text()
        assert fallback_text == f"Issue unassigned by {self.name}"
        assert blocks[0]["text"]["text"] == fallback_text
        self.assert_performance_issue_blocks(
            blocks,
            event.organization.slug,
            event.project.slug,
            event.group,
            "unassigned_activity-slack",
        )

    @responses.activate
    @mock.patch(
        "sentry.eventstore.models.GroupEvent.occurrence",
        return_value=TEST_ISSUE_OCCURRENCE,
        new_callable=mock.PropertyMock,
    )
    def test_unassignment_generic_issue(self, occurrence):
        """
        Test that a Slack message is sent with the expected payload when a generic issue type is unassigned
        """
        event = self.store_event(
            data={"message": "Hellboy's world", "level": "error"}, project_id=self.project.id
        )
        group_event = event.for_group(event.groups[0])
        with self.tasks():
            self.create_notification(group_event.group).send()

        attachment, text = get_attachment()
        assert text == f"Issue unassigned by {self.name}"
        self.assert_generic_issue_attachments(
            attachment, self.project.slug, "unassigned_activity-slack-user"
        )

    @responses.activate
    @mock.patch(
        "sentry.eventstore.models.GroupEvent.occurrence",
        return_value=TEST_ISSUE_OCCURRENCE,
        new_callable=mock.PropertyMock,
    )
    @with_feature("organizations:slack-block-kit")
    def test_unassignment_generic_issue_block(self, occurrence):
        """
        Test that a Slack message is sent with the expected payload when a generic issue type is unassigned
        and block kit is enabled.
        """
        event = self.store_event(
            data={"message": "Hellboy's world", "level": "error"}, project_id=self.project.id
        )
        group_event = event.for_group(event.groups[0])
        with self.tasks():
            self.create_notification(group_event.group).send()

        blocks, fallback_text = get_blocks_and_fallback_text()
        assert fallback_text == f"Issue unassigned by {self.name}"
        assert blocks[0]["text"]["text"] == fallback_text
        self.assert_generic_issue_blocks(
            blocks,
            group_event.organization.slug,
            group_event.project.slug,
            group_event.group,
            "unassigned_activity-slack",
        )
