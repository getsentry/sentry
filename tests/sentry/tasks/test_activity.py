from unittest import mock

from sentry.issues.action_log import ActionSource, GroupActionActor, action_context_scope
from sentry.issues.action_log.types import GroupActionType
from sentry.models.activity import Activity
from sentry.notifications.platform.types import NotificationSource
from sentry.tasks.activity import send_activity_notifications
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import outbox_runner
from sentry.types.activity import ActivityType


class ActivityNotificationsTest(TestCase):
    @mock.patch("sentry.tasks.activity.send_activity_notifications")
    def test_simple(self, mock_func: mock.MagicMock) -> None:
        group = self.create_group()
        Activity.objects.create_group_activity(
            group, ActivityType.ASSIGNED, user=self.user, data={"assignee": None}
        )
        assert mock_func.delay.call_count == 1

    @mock.patch("sentry.notifications.platform.service.NotificationService")
    @mock.patch(
        "sentry.notifications.platform.templates.activity.base.build_activity_notification_data_from_context"
    )
    @mock.patch(
        "sentry.notifications.platform.strategies.issue_subscribers.IssueSubscribersActivityStrategy"
    )
    def test_uses_group_action_log_entry(
        self,
        mock_strategy: mock.MagicMock,
        mock_build_data: mock.MagicMock,
        mock_notification_service: mock.MagicMock,
    ) -> None:
        with (
            self.feature("projects:issue-action-log-write-to-db"),
            outbox_runner(),
            action_context_scope(
                source=ActionSource.API,
                actor=GroupActionActor.user(self.user.id),
            ),
        ):
            activity = self.create_group_activity(
                group=self.group,
                type=ActivityType.ASSIGNED.value,
                user_id=self.create_user().id,
                data={
                    "assignee": str(self.user.id),
                    "assigneeType": "user",
                },
            )
        target = mock.MagicMock()
        mock_strategy.return_value.get_targets.return_value = [target]
        mock_notification_service.has_access.return_value = True

        send_activity_notifications(activity_id=activity.id)

        mock_notification_service.has_access.assert_called_once_with(
            organization=self.organization,
            source=NotificationSource.ACTIVITY_ASSIGNED,
        )
        mock_strategy.assert_called_once_with(
            group=activity.group,
            actor_user_id=self.user.id,
        )
        context = mock_build_data.call_args.kwargs["context"]
        assert context.activity_type == ActivityType.ASSIGNED.value
        assert context.activity_data == {
            "assignee": str(self.user.id),
            "assigneeType": "user",
        }
        assert context.actor_user_id == self.user.id
        mock_build_data.assert_called_once_with(context=context, target=target)

    @mock.patch("sentry.notifications.platform.service.NotificationService")
    @mock.patch(
        "sentry.notifications.platform.templates.activity.base.build_activity_notification_data_from_context"
    )
    @mock.patch(
        "sentry.notifications.platform.strategies.issue_subscribers.IssueSubscribersActivityStrategy"
    )
    def test_ignores_group_action_log_entry_with_mismatched_type(
        self,
        mock_strategy: mock.MagicMock,
        mock_build_data: mock.MagicMock,
        mock_notification_service: mock.MagicMock,
    ) -> None:
        with self.feature({"projects:issue-action-log-write-to-db": False}):
            activity = self.create_group_activity(
                group=self.group,
                type=ActivityType.SET_RESOLVED.value,
                user_id=self.user.id,
                data={"status": "resolved"},
            )
        self.create_group_action_log_entry(
            group=self.group,
            type=GroupActionType.UNRESOLVE,
            idempotency_key=f"activity:{activity.id}",
        )
        target = mock.MagicMock()
        mock_strategy.return_value.get_targets.return_value = [target]
        mock_notification_service.has_access.return_value = True

        send_activity_notifications(activity_id=activity.id)

        mock_strategy.assert_called_once_with(
            group=activity.group,
            actor_user_id=self.user.id,
        )
        context = mock_build_data.call_args.kwargs["context"]
        assert context.activity_type == activity.type
        assert context.activity_data == activity.data
        assert context.actor_user_id == activity.user_id
        mock_build_data.assert_called_once_with(context=context, target=target)
