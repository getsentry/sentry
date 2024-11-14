from unittest import mock

import orjson

from sentry.integrations.types import ExternalProviders
from sentry.models.activity import Activity
from sentry.notifications.notifications.activity.assigned import AssignedActivityNotification
from sentry.testutils.cases import PerformanceIssueTestCase, SlackActivityNotificationTest
from sentry.testutils.helpers.notifications import TEST_ISSUE_OCCURRENCE, TEST_PERF_ISSUE_OCCURRENCE
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType

pytestmark = [requires_snuba]


class SlackAssignedNotificationTest(SlackActivityNotificationTest, PerformanceIssueTestCase):
    def create_notification(self, group, notification):
        return notification(
            Activity(
                project=self.project,
                group=group,
                user_id=self.user.id,
                type=ActivityType.ASSIGNED,
                data={"assignee": self.user.id},
            )
        )

    def test_multiple_identities(self):
        """
        Test that we notify a user with multiple Identities in each place
        """
        integration2, _ = self.create_provider_integration_for(
            organization=self.organization,
            user=self.user,
            provider="slack",
            name="Team B",
            external_id="TXXXXXXX2",
            metadata={
                "access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "installation_type": "born_as_bot",
            },
        )
        idp2 = self.create_identity_provider(type="slack", external_id="TXXXXXXX2")
        identity2 = self.create_identity(
            user=self.user,
            external_id="UXXXXXXX2",
            identity_provider=idp2,
        )

        with self.tasks():
            self.create_notification(self.group, AssignedActivityNotification).send()

        assert self.mock_post.call_count == 2
        data = self.mock_post.call_args_list[0].kwargs
        assert "channel" in data
        channel = data["channel"]
        assert channel == self.identity.external_id

        data = self.mock_post.call_args_list[1].kwargs
        assert "channel" in data
        channel = data["channel"]
        assert channel == identity2.external_id

    def test_multiple_orgs(self):
        """
        Test that if a user is in 2 orgs with Slack and has an Identity linked in each,
        we're only going to notify them for the relevant org
        """
        org2 = self.create_organization(owner=self.user)
        self.create_provider_integration_for(
            organization=org2,
            user=self.user,
            provider="slack",
            name="Team B",
            external_id="TXXXXXXX2",
            metadata={
                "access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "installation_type": "born_as_bot",
            },
        )
        idp2 = self.create_identity_provider(type="slack", external_id="TXXXXXXX2")
        self.create_identity(external_id="UXXXXXXX2", identity_provider=idp2, user=self.user)

        with self.tasks():
            self.create_notification(self.group, AssignedActivityNotification).send()

        assert self.mock_post.call_count == 1
        assert self.mock_post.call_args.kwargs["channel"] == self.identity.external_id

    def test_assignment_block(self):
        """
        Test that a Slack message is sent with the expected payload when an issue is assigned
        and block kit is enabled.
        """
        with self.tasks():
            self.create_notification(self.group, AssignedActivityNotification).send()
        blocks = orjson.loads(self.mock_post.call_args.kwargs["blocks"])
        fallback_text = self.mock_post.call_args.kwargs["text"]
        assert fallback_text == f"Issue assigned to {self.name} by themselves"
        assert blocks[0]["text"]["text"] == fallback_text
        notification_uuid = self.get_notification_uuid(blocks[1]["text"]["text"])
        assert (
            blocks[1]["text"]["text"]
            == f":red_circle: <http://testserver/organizations/{self.organization.slug}/issues/{self.group.id}/?referrer=assigned_activity-slack&notification_uuid={notification_uuid}|*{self.group.title}*>"
        )
        assert (
            blocks[3]["elements"][0]["text"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=assigned_activity-slack-user&notification_uuid={notification_uuid}&organizationId={self.organization.id}|Notification Settings>"
        )

    @mock.patch(
        "sentry.eventstore.models.GroupEvent.occurrence",
        return_value=TEST_ISSUE_OCCURRENCE,
        new_callable=mock.PropertyMock,
    )
    def test_assignment_generic_issue_block(self, occurrence):
        """
        Test that a Slack message is sent with the expected payload when a generic issue type is assigned
        and block kit is enabled.
        """
        event = self.store_event(
            data={"message": "Hellboy's world", "level": "error"}, project_id=self.project.id
        )
        group_event = event.for_group(event.groups[0])

        with self.tasks():
            self.create_notification(group_event.group, AssignedActivityNotification).send()
        blocks = orjson.loads(self.mock_post.call_args.kwargs["blocks"])
        fallback_text = self.mock_post.call_args.kwargs["text"]
        assert fallback_text == f"Issue assigned to {self.name} by themselves"
        assert blocks[0]["text"]["text"] == fallback_text
        self.assert_generic_issue_blocks(
            blocks,
            group_event.organization,
            group_event.project.slug,
            group_event.group,
            "assigned_activity-slack",
        )

    @mock.patch(
        "sentry.eventstore.models.GroupEvent.occurrence",
        return_value=TEST_PERF_ISSUE_OCCURRENCE,
        new_callable=mock.PropertyMock,
    )
    def test_assignment_performance_issue_block_with_culprit_blocks(self, occurrence):
        """
        Test that a Slack message is sent with the expected payload when a performance issue is assigned
        and block kit is enabled.
        """
        event = self.create_performance_issue()
        with self.tasks():
            self.create_notification(event.group, AssignedActivityNotification).send()

        blocks = orjson.loads(self.mock_post.call_args.kwargs["blocks"])
        fallback_text = self.mock_post.call_args.kwargs["text"]

        assert fallback_text == f"Issue assigned to {self.name} by themselves"
        assert blocks[0]["text"]["text"] == fallback_text
        self.assert_performance_issue_blocks_with_culprit_blocks(
            blocks,
            event.organization,
            event.project.slug,
            event.group,
            "assigned_activity-slack",
        )

    def test_automatic_assignment(self):
        notification = AssignedActivityNotification(
            Activity(
                project=self.project,
                group=self.group,
                type=ActivityType.ASSIGNED,
                data={"assignee": self.user.id},
            )
        )
        assert (
            notification.get_notification_title(ExternalProviders.SLACK)
            == f"Issue automatically assigned to {self.user.get_display_name()}"
        )
