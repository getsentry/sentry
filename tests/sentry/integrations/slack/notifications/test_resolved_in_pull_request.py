from unittest import mock

import orjson

from sentry.models.activity import Activity
from sentry.notifications.notifications.activity.resolved_in_pull_request import (
    ResolvedInPullRequestActivityNotification,
)
from sentry.testutils.cases import PerformanceIssueTestCase, SlackActivityNotificationTest
from sentry.testutils.helpers.notifications import TEST_ISSUE_OCCURRENCE, TEST_PERF_ISSUE_OCCURRENCE
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType

pytestmark = [requires_snuba]


class SlackResolvedInPullRequestNotificationTest(
    SlackActivityNotificationTest, PerformanceIssueTestCase
):
    def setUp(self):
        super().setUp()
        self.pull_request_url = "https://github.com/example/pull/123"

    def create_notification(self, group):
        return ResolvedInPullRequestActivityNotification(
            Activity(
                project=self.project,
                group=group,
                user_id=self.user.id,
                type=ActivityType.SET_RESOLVED_IN_PULL_REQUEST,
                data={"pull_request": {"externalUrl": self.pull_request_url}},
            )
        )

    def test_resolved_in_pull_request_block(self):
        notification = self.create_notification(self.group)
        with self.tasks():
            notification.send()

        blocks = orjson.loads(self.mock_post.call_args.kwargs["blocks"])
        fallback_text = self.mock_post.call_args.kwargs["text"]
        notification_uuid = self.get_notification_uuid(blocks[1]["text"]["text"])
        assert (
            fallback_text
            == f"{self.name} made a <{self.pull_request_url}| pull request> that will resolve <http://testserver/organizations/{self.organization.slug}/issues/{self.group.id}/?referrer=activity_notification&notification_uuid={notification_uuid}|{self.short_id}>"
        )
        assert blocks[0]["text"]["text"] == fallback_text

        assert (
            blocks[1]["text"]["text"]
            == f":red_circle: <http://testserver/organizations/{self.organization.slug}/issues/{self.group.id}/?referrer=resolved_in_pull_request_activity-slack&notification_uuid={notification_uuid}|*{self.group.title}*>"
        )
        assert (
            blocks[3]["elements"][0]["text"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=resolved_in_pull_request_activity-slack-user&notification_uuid={notification_uuid}&organizationId={self.organization.id}|Notification Settings>"
        )

    @mock.patch(
        "sentry.eventstore.models.GroupEvent.occurrence",
        return_value=TEST_PERF_ISSUE_OCCURRENCE,
        new_callable=mock.PropertyMock,
    )
    def test_resolved_in_pull_request_performance_issue_block_with_culprit_blocks(self, occurrence):
        """
        Test that a Slack message is sent with the expected payload when a performance issue is resolved in a pull request
        and block kit is enabled.
        """
        event = self.create_performance_issue()
        notification = self.create_notification(event.group)
        with self.tasks():
            notification.send()

        blocks = orjson.loads(self.mock_post.call_args.kwargs["blocks"])
        fallback_text = self.mock_post.call_args.kwargs["text"]
        notification_uuid = self.get_notification_uuid(blocks[1]["text"]["text"])

        assert (
            fallback_text
            == f"{self.name} made a <{self.pull_request_url}| pull request> that will resolve <http://testserver/organizations/{event.organization.slug}/issues/{event.group.id}/?referrer=activity_notification&notification_uuid={notification_uuid}|{event.group.qualified_short_id}>"
        )
        assert blocks[0]["text"]["text"] == fallback_text
        self.assert_performance_issue_blocks_with_culprit_blocks(
            blocks,
            event.organization,
            event.project.slug,
            event.group,
            "resolved_in_pull_request_activity-slack",
        )

    @mock.patch(
        "sentry.eventstore.models.GroupEvent.occurrence",
        return_value=TEST_ISSUE_OCCURRENCE,
        new_callable=mock.PropertyMock,
    )
    def test_resolved_in_pull_request_generic_issue_block(self, occurrence):
        """
        Test that a Slack message is sent with the expected payload when a generic issue type is resolved in a pull request
        and block kit is enabled.
        """
        event = self.store_event(
            data={"message": "Hellboy's world", "level": "error"}, project_id=self.project.id
        )
        group_event = event.for_group(event.groups[0])
        notification = self.create_notification(group_event.group)
        with self.tasks():
            notification.send()

        blocks = orjson.loads(self.mock_post.call_args.kwargs["blocks"])
        fallback_text = self.mock_post.call_args.kwargs["text"]
        notification_uuid = self.get_notification_uuid(blocks[1]["text"]["text"])

        assert (
            fallback_text
            == f"{self.name} made a <{self.pull_request_url}| pull request> that will resolve <http://testserver/organizations/{group_event.organization.slug}/issues/{group_event.group.id}/?referrer=activity_notification&notification_uuid={notification_uuid}|{group_event.group.qualified_short_id}>"
        )
        assert blocks[0]["text"]["text"] == fallback_text
        self.assert_generic_issue_blocks(
            blocks,
            group_event.organization,
            group_event.project.slug,
            group_event.group,
            "resolved_in_pull_request_activity-slack",
        )
