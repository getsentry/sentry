from unittest import mock

import responses

from sentry.models.activity import Activity
from sentry.notifications.notifications.activity.resolved_in_release import (
    ResolvedInReleaseActivityNotification,
)
from sentry.testutils.cases import PerformanceIssueTestCase, SlackActivityNotificationTest
from sentry.testutils.helpers.notifications import TEST_ISSUE_OCCURRENCE, TEST_PERF_ISSUE_OCCURRENCE
from sentry.testutils.helpers.slack import get_attachment
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType

pytestmark = [requires_snuba]


@region_silo_test
class SlackResolvedInReleaseNotificationTest(
    SlackActivityNotificationTest, PerformanceIssueTestCase
):
    def create_notification(self, group, version="meow"):
        return ResolvedInReleaseActivityNotification(
            Activity(
                project=self.project,
                group=group,
                user_id=self.user.id,
                type=ActivityType.SET_RESOLVED_IN_RELEASE,
                data={"version": version},
            )
        )

    @responses.activate
    def test_resolved_in_release(self):
        """
        Test that a Slack message is sent with the expected payload when an issue is resolved in a release
        """
        notification = self.create_notification(self.group)
        with self.tasks():
            notification.send()

        attachment, text = get_attachment()
        release_name = notification.activity.data["version"]
        assert text == f"Issue marked as resolved in {release_name} by {self.name}"
        notification_uuid = self.get_notification_uuid(attachment["title_link"])
        assert (
            attachment["footer"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=resolved_in_release_activity-slack-user&notification_uuid={notification_uuid}|Notification Settings>"
        )

    @responses.activate
    @mock.patch(
        "sentry.eventstore.models.GroupEvent.occurrence",
        return_value=TEST_PERF_ISSUE_OCCURRENCE,
        new_callable=mock.PropertyMock,
    )
    def test_resolved_in_release_performance_issue(self, occurrence):
        """
        Test that a Slack message is sent with the expected payload when a performance issue is resolved in a release
        """
        event = self.create_performance_issue()
        notification = self.create_notification(event.group)
        with self.tasks():
            notification.send()

        attachment, text = get_attachment()
        release_name = notification.activity.data["version"]
        assert text == f"Issue marked as resolved in {release_name} by {self.name}"
        self.assert_performance_issue_attachments(
            attachment, self.project.slug, "resolved_in_release_activity-slack-user"
        )

    @responses.activate
    @mock.patch(
        "sentry.eventstore.models.GroupEvent.occurrence",
        return_value=TEST_ISSUE_OCCURRENCE,
        new_callable=mock.PropertyMock,
    )
    def test_resolved_in_release_generic_issue(self, occurrence):
        """
        Test that a Slack message is sent with the expected payload when a generic issue type is resolved in a release
        """
        event = self.store_event(
            data={"message": "Hellboy's world", "level": "error"}, project_id=self.project.id
        )
        group_event = event.for_group(event.groups[0])
        notification = self.create_notification(group_event.group)
        with self.tasks():
            notification.send()

        attachment, text = get_attachment()
        release_name = notification.activity.data["version"]
        assert text == f"Issue marked as resolved in {release_name} by {self.name}"
        self.assert_generic_issue_attachments(
            attachment, self.project.slug, "resolved_in_release_activity-slack-user"
        )

    @responses.activate
    def test_resolved_in_release_parsed_version(self):
        """
        Test that the release version is formatted to the short version
        """
        notification = self.create_notification(self.group, version="frontend@1.0.0")
        with self.tasks():
            notification.send()

        attachment, text = get_attachment()
        assert text == f"Issue marked as resolved in 1.0.0 by {self.name}"
        notification_uuid = self.get_notification_uuid(attachment["title_link"])
        assert (
            attachment["footer"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=resolved_in_release_activity-slack-user&notification_uuid={notification_uuid}|Notification Settings>"
        )
