from unittest import mock

from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.notification_action.activity_registry.email import EmailActivityHandler
from sentry.notifications.notification_action.registry import activity_handler_registry
from sentry.notifications.platform.target import GenericNotificationTarget
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationTargetResourceType,
)
from sentry.notifications.types import NotificationSettingEnum
from sentry.types.activity import ActivityType
from sentry.workflow_engine.models import Action
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestEmailActivityHandlerRegistration:
    def test_email_registered(self) -> None:
        assert activity_handler_registry.get(Action.Type.EMAIL) is EmailActivityHandler


class TestEmailActivityHandler(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()
        self.workflow, self.detector, _, _ = self.create_detector_and_workflow()
        self.action = self.create_action(
            type=Action.Type.EMAIL,
            config={
                "target_type": ActionTarget.USER,
                "target_identifier": str(self.user.id),
            },
        )

    @mock.patch(
        "sentry.notifications.notification_action.activity_registry.email.send_activity_notification"
    )
    def test_invoke_action_user(self, mock_send: mock.MagicMock) -> None:
        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.SEER_RCA_STARTED.value,
        )
        invocation = self.create_action_invocation(
            event=activity,
            group=self.group,
            action=self.action,
            detector=self.detector,
            workflow_id=self.workflow.id,
        )

        EmailActivityHandler.invoke_action(invocation=invocation, activity=activity)

        mock_send.assert_called_once()
        call_args = mock_send.call_args
        assert call_args[0][0] is invocation
        assert call_args[0][1] is activity

        target = call_args[0][2]
        assert isinstance(target, GenericNotificationTarget)
        assert target.provider_key == NotificationProviderKey.EMAIL
        assert target.resource_type == NotificationTargetResourceType.EMAIL
        assert target.resource_id == self.user.email
        assert target.specific_data == {"user_id": self.user.id}

    @mock.patch(
        "sentry.notifications.notification_action.activity_registry.email.send_activity_notification"
    )
    def test_invoke_action_user_no_longer_in_organization(self, mock_send: mock.MagicMock) -> None:
        former_member = self.create_user(email="former-member@example.com")
        self.action.config["target_identifier"] = str(former_member.id)
        self.action.save()
        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.SEER_RCA_STARTED.value,
        )
        invocation = self.create_action_invocation(
            event=activity,
            group=self.group,
            action=self.action,
            detector=self.detector,
            workflow_id=self.workflow.id,
        )

        EmailActivityHandler.invoke_action(invocation=invocation, activity=activity)

        mock_send.assert_not_called()

    @mock.patch(
        "sentry.notifications.notification_action.activity_registry.email.send_activity_notification"
    )
    def test_invoke_action_team(self, mock_send: mock.MagicMock) -> None:
        user_a = self.create_user(email="a@example.com")
        user_b = self.create_user(email="b@example.com")
        team = self.create_team(organization=self.organization)
        self.create_team_membership(team=team, user=user_a)
        self.create_team_membership(team=team, user=user_b)
        self.action.config = {
            "target_type": ActionTarget.TEAM,
            "target_identifier": str(team.id),
        }
        self.action.save()
        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.SEER_RCA_STARTED.value,
        )
        invocation = self.create_action_invocation(
            event=activity,
            group=self.group,
            action=self.action,
            detector=self.detector,
            workflow_id=self.workflow.id,
        )

        EmailActivityHandler.invoke_action(invocation=invocation, activity=activity)

        assert mock_send.call_count == 2
        targets = [call.args[2] for call in mock_send.call_args_list]
        assert {target.resource_id for target in targets} == {"a@example.com", "b@example.com"}
        assert {target.specific_data["user_id"] for target in targets} == {
            user_a.id,
            user_b.id,
        }

    @mock.patch(
        "sentry.notifications.notification_action.activity_registry.email.send_activity_notification"
    )
    @mock.patch(
        "sentry.notifications.notification_action.activity_registry.email.IssueOwnersActivityAlertStrategy"
    )
    def test_invoke_action_issue_owners(
        self,
        mock_strategy_cls: mock.MagicMock,
        mock_send: mock.MagicMock,
    ) -> None:
        self.action.config = {
            "target_type": ActionTarget.ISSUE_OWNERS,
        }
        self.action.save()

        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.SEER_RCA_STARTED.value,
        )
        invocation = self.create_action_invocation(
            event=activity,
            group=self.group,
            action=self.action,
            detector=self.detector,
            workflow_id=self.workflow.id,
        )

        mock_target = mock.MagicMock()
        mock_strategy_cls.return_value.get_targets.return_value = [mock_target]

        EmailActivityHandler.invoke_action(invocation=invocation, activity=activity)

        mock_strategy_cls.assert_called_once_with(group=activity.group)
        mock_send.assert_called_once_with(invocation, activity, mock_target)

    @mock.patch(
        "sentry.notifications.notification_action.activity_registry.email.send_activity_notification"
    )
    def test_pr_ready_issue_owner_with_issue_alerts_disabled(
        self, mock_send: mock.MagicMock
    ) -> None:
        self.create_group_owner(group=self.group, user_id=self.user.id)
        self.create_notification_setting_option(
            user_id=self.user.id,
            scope_type="user",
            scope_identifier=self.user.id,
            type=NotificationSettingEnum.ISSUE_ALERTS.value,
            value="never",
        )
        self.action.config = {"target_type": ActionTarget.ISSUE_OWNERS}
        self.action.save()
        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.SEER_PR_READY_FOR_REVIEW.value,
        )
        invocation = self.create_action_invocation(
            event=activity,
            group=self.group,
            action=self.action,
            detector=self.detector,
            workflow_id=self.workflow.id,
        )

        EmailActivityHandler.invoke_action(invocation=invocation, activity=activity)

        mock_send.assert_not_called()
