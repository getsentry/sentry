from unittest import mock

import responses

from sentry.event_manager import EventManager
from sentry.models import Activity
from sentry.notifications.notifications.activity import RegressionActivityNotification
from sentry.testutils.cases import SlackActivityNotificationTest
from sentry.testutils.helpers import override_options
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.slack import get_attachment, send_notification
from sentry.types.activity import ActivityType
from sentry.types.issues import GroupType
from sentry.utils.samples import load_data


class SlackRegressionNotificationTest(SlackActivityNotificationTest):
    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_regression(self, mock_func):
        """
        Test that a Slack message is sent with the expected payload when an issue regresses
        """
        notification = RegressionActivityNotification(
            Activity(
                project=self.project,
                group=self.group,
                user=self.user,
                type=ActivityType.SET_REGRESSION,
                data={},
            )
        )
        with self.tasks():
            notification.send()

        attachment, text = get_attachment()
        assert text == "Issue marked as regression"
        assert attachment["title"] == "こんにちは"
        assert attachment["text"] == ""
        assert (
            attachment["footer"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=regression_activity-slack-user|Notification Settings>"
        )

    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_regression_performance_issue(self, mock_func):
        """
        Test that a Slack message is sent with the expected payload when a performance issue regresses
        """
        event_data = load_data(
            "transaction-n-plus-one",
            timestamp=before_now(minutes=10),
            fingerprint=[f"{GroupType.PERFORMANCE_N_PLUS_ONE.value}-group1"],
        )
        perf_event_manager = EventManager(event_data)
        perf_event_manager.normalize()
        with override_options(
            {
                "performance.issues.all.problem-creation": 1.0,
                "performance.issues.all.problem-detection": 1.0,
                "performance.issues.n_plus_one_db.problem-creation": 1.0,
            }
        ), self.feature(
            [
                "organizations:performance-issues-ingest",
                "projects:performance-suspect-spans-ingestion",
            ]
        ):
            event = perf_event_manager.save(self.project.id)
        event = event.for_group(event.groups[0])
        perf_group = event.group

        with self.feature("organizations:performance-issues"):
            notification = RegressionActivityNotification(
                Activity(
                    project=self.project,
                    group=perf_group,
                    user=self.user,
                    type=ActivityType.SET_REGRESSION,
                    data={},
                )
            )
            with self.tasks():
                notification.send()

        attachment, text = get_attachment()
        assert text == "Issue marked as regression"
        assert attachment["title"] == "N+1 Query"
        assert (
            attachment["text"]
            == "db - SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21"
        )
        assert (
            attachment["footer"]
            == f"{self.project.slug} | production | <http://testserver/settings/account/notifications/workflow/?referrer=regression_activity-slack-user|Notification Settings>"
        )
