from unittest import mock

from sentry.integrations.slack.tasks.send_notifications_on_activity import (
    activity_created_receiver,
    send_activity_notifications_to_slack_threads,
)
from sentry.models.activity import Activity
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType


class TestActivityCreatedReceiver(TestCase):
    def setUp(self) -> None:
        self.mock_send_activity_notifications = mock.MagicMock()
        mock_method = mock.MagicMock()
        self.mock_send_activity_notifications.apply_async = mock_method

    def test_ignores_uncreated_events(self) -> None:
        with mock.patch(
            "sentry.integrations.slack.tasks.send_notifications_on_activity.send_activity_notifications_to_slack_threads",
            self.mock_send_activity_notifications,
        ):
            foo = mock.MagicMock()
            foo.id = 123
            activity_created_receiver(foo, False)
            self.mock_send_activity_notifications.apply_async.assert_not_called()

    def test_calls_async_function(self) -> None:
        with mock.patch(
            "sentry.integrations.slack.tasks.send_notifications_on_activity.send_activity_notifications_to_slack_threads",
            self.mock_send_activity_notifications,
        ):
            mock_activity = mock.MagicMock()
            mock_activity.id = 123
            activity_created_receiver(mock_activity, True)
            self.mock_send_activity_notifications.apply_async.assert_called_with(
                kwargs={"activity_id": mock_activity.id}
            )

    def test_receiver_signal(self) -> None:
        with mock.patch(
            "sentry.integrations.slack.tasks.send_notifications_on_activity.send_activity_notifications_to_slack_threads",
            self.mock_send_activity_notifications,
        ):
            new_activity = Activity.objects.create(
                project=self.project,
                group=self.group,
                type=ActivityType.NOTE.value,
                data={},
                user_id=self.user.id,
            )
            self.mock_send_activity_notifications.apply_async.assert_called_with(
                kwargs={"activity_id": new_activity.id}
            )


class TestSendActivityNotifications(TestCase):
    def setUp(self) -> None:
        mock_slack_service = mock.MagicMock()
        mock_default_method = mock.MagicMock(return_value=mock_slack_service)
        mock_notify_all_threads_for_activity = mock.MagicMock()
        mock_slack_service.default = mock_default_method
        mock_slack_service.notify_all_threads_for_activity = mock_notify_all_threads_for_activity

        self.mock_slack_service = mock_slack_service

    def test_returns_early_when_no_activity_found(self) -> None:
        with mock.patch(
            "sentry.integrations.slack.tasks.send_notifications_on_activity.SlackService",
            self.mock_slack_service,
        ):
            send_activity_notifications_to_slack_threads(activity_id=123)
            self.mock_slack_service.notify_all_threads_for_activity.assert_not_called()

    def test_calls_notify_all_threads_for_activity(self) -> None:
        with mock.patch(
            "sentry.integrations.slack.tasks.send_notifications_on_activity.SlackService",
            self.mock_slack_service,
        ):
            send_activity_notifications_to_slack_threads(activity_id=self.activity.id)
            self.mock_slack_service.notify_all_threads_for_activity.assert_called()
