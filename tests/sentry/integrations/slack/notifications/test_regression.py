from unittest import mock

import responses

from sentry.models.activity import Activity
from sentry.notifications.notifications.activity.regression import RegressionActivityNotification
from sentry.testutils.cases import PerformanceIssueTestCase, SlackActivityNotificationTest
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.notifications import TEST_ISSUE_OCCURRENCE, TEST_PERF_ISSUE_OCCURRENCE
from sentry.testutils.helpers.slack import get_attachment, get_blocks_and_fallback_text
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType

pytestmark = [requires_snuba]


class SlackRegressionNotificationTest(SlackActivityNotificationTest, PerformanceIssueTestCase):
    def create_notification(self, group, data=None):
        return RegressionActivityNotification(
            Activity(
                project=self.project,
                group=group,
                user_id=self.user.id,
                type=ActivityType.SET_REGRESSION,
                data=data or {},
            )
        )

    @responses.activate
    def test_regression(self):
        """
        Test that a Slack message is sent with the expected payload when an issue regresses
        """
        with self.tasks():
            self.create_notification(self.group).send()

        attachment, text = get_attachment()
        assert text == "Issue marked as regression"
        assert attachment["title"] == "こんにちは"
        assert attachment["text"] == ""
        notification_uuid = self.get_notification_uuid(attachment["title_link"])
        assert (
            attachment["footer"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=regression_activity-slack-user&notification_uuid={notification_uuid}|Notification Settings>"
        )

    @responses.activate
    @with_feature("organizations:slack-block-kit")
    def test_regression_block(self):
        """
        Test that a Slack message is sent with the expected payload when an issue regresses
        and block kit is enabled.
        """
        with self.tasks():
            self.create_notification(self.group).send()

        blocks, fallback_text = get_blocks_and_fallback_text()
        assert fallback_text == "Issue marked as regression"
        assert blocks[0]["text"]["text"] == fallback_text
        notification_uuid = self.get_notification_uuid(blocks[1]["text"]["text"])
        assert blocks[1]["text"]["text"] == (
            f":red_circle: <http://testserver/organizations/{self.organization.slug}/issues/{self.group.id}/?referrer=regression_activity-slack&notification_uuid={notification_uuid}|*{self.group.title}*>"
        )
        assert blocks[3]["elements"][0]["text"] == (
            f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=regression_activity-slack-user&notification_uuid={notification_uuid}|Notification Settings>"
        )

    @responses.activate
    def test_regression_with_release(self):
        """
        Test that a Slack message is sent with the expected payload when an issue regresses
        """
        with self.tasks():
            self.create_notification(self.group, {"version": "1.0.0"}).send()

        attachment, text = get_attachment()
        notification_uuid = self.get_notification_uuid(attachment["title_link"])
        assert (
            text
            == f"Issue marked as regression in release <http://testserver/organizations/baz/releases/1.0.0/?referrer=regression_activity&notification_uuid={notification_uuid}|1.0.0>"
        )
        assert attachment["title"] == "こんにちは"
        assert attachment["text"] == ""
        notification_uuid = self.get_notification_uuid(attachment["title_link"])
        assert (
            attachment["footer"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=regression_activity-slack-user&notification_uuid={notification_uuid}|Notification Settings>"
        )

    @responses.activate
    @with_feature("organizations:slack-block-kit")
    def test_regression_with_release_block(self):
        """
        Test that a Slack message is sent with the expected payload when an issue regresses
        and block kit is enabled.
        """
        with self.tasks():
            self.create_notification(self.group, {"version": "1.0.0"}).send()

        blocks, fallback_text = get_blocks_and_fallback_text()
        notification_uuid = self.get_notification_uuid(blocks[1]["text"]["text"])
        assert (
            fallback_text
            == f"Issue marked as regression in release <http://testserver/organizations/baz/releases/1.0.0/?referrer=regression_activity&notification_uuid={notification_uuid}|1.0.0>"
        )
        assert blocks[0]["text"]["text"] == fallback_text
        assert blocks[1]["text"]["text"] == (
            f":red_circle: <http://testserver/organizations/{self.organization.slug}/issues/{self.group.id}/?referrer=regression_activity-slack&notification_uuid={notification_uuid}|*{self.group.title}*>"
        )
        assert blocks[3]["elements"][0]["text"] == (
            f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=regression_activity-slack-user&notification_uuid={notification_uuid}|Notification Settings>"
        )

    @responses.activate
    @mock.patch(
        "sentry.eventstore.models.GroupEvent.occurrence",
        return_value=TEST_PERF_ISSUE_OCCURRENCE,
        new_callable=mock.PropertyMock,
    )
    def test_regression_performance_issue(self, occurrence):
        """
        Test that a Slack message is sent with the expected payload when a performance issue regresses
        """
        event = self.create_performance_issue()
        with self.tasks():
            self.create_notification(event.group).send()

        attachment, text = get_attachment()
        assert text == "Issue marked as regression"
        self.assert_performance_issue_attachments(
            attachment, self.project.slug, "regression_activity-slack-user"
        )

    @responses.activate
    @mock.patch(
        "sentry.eventstore.models.GroupEvent.occurrence",
        return_value=TEST_PERF_ISSUE_OCCURRENCE,
        new_callable=mock.PropertyMock,
    )
    @with_feature("organizations:slack-block-kit")
    def test_regression_performance_issue_block(self, occurrence):
        """
        Test that a Slack message is sent with the expected payload when a performance issue regresses
        and block kit is enabled.
        """
        event = self.create_performance_issue()
        with self.tasks():
            self.create_notification(event.group).send()

        blocks, fallback_text = get_blocks_and_fallback_text()
        assert fallback_text == "Issue marked as regression"
        assert blocks[0]["text"]["text"] == fallback_text
        self.assert_performance_issue_blocks(
            blocks,
            event.organization.slug,
            event.project.slug,
            event.group,
            "regression_activity-slack",
        )

    @responses.activate
    @mock.patch(
        "sentry.eventstore.models.GroupEvent.occurrence",
        return_value=TEST_ISSUE_OCCURRENCE,
        new_callable=mock.PropertyMock,
    )
    def test_regression_generic_issue(self, occurrence):
        """
        Test that a Slack message is sent with the expected payload when a generic issue type regresses
        """
        event = self.store_event(
            data={"message": "Hellboy's world", "level": "error"}, project_id=self.project.id
        )
        group_event = event.for_group(event.groups[0])

        with self.tasks():
            self.create_notification(group_event.group).send()

        attachment, text = get_attachment()
        assert text == "Issue marked as regression"
        self.assert_generic_issue_attachments(
            attachment, self.project.slug, "regression_activity-slack-user"
        )

    @responses.activate
    @mock.patch(
        "sentry.eventstore.models.GroupEvent.occurrence",
        return_value=TEST_ISSUE_OCCURRENCE,
        new_callable=mock.PropertyMock,
    )
    @with_feature("organizations:slack-block-kit")
    def test_regression_generic_issue_block(self, occurrence):
        """
        Test that a Slack message is sent with the expected payload when a generic issue type regresses
        and block kit is enabled.
        """
        event = self.store_event(
            data={"message": "Hellboy's world", "level": "error"}, project_id=self.project.id
        )
        group_event = event.for_group(event.groups[0])

        with self.tasks():
            self.create_notification(group_event.group).send()

        blocks, fallback_text = get_blocks_and_fallback_text()
        assert fallback_text == "Issue marked as regression"
        assert blocks[0]["text"]["text"] == fallback_text
        self.assert_generic_issue_blocks(
            blocks,
            group_event.organization.slug,
            group_event.project.slug,
            group_event.group,
            "regression_activity-slack",
        )
