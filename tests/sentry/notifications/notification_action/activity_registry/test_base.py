from unittest import mock

from sentry.notifications.notification_action.activity_registry.base import (
    NOTIFICATION_PLATFORM_COMPATIBLE_ACTIVITIES,
    build_activity_notification_data,
    send_activity_notification,
)
from sentry.notifications.notification_action.activity_registry.discord import (
    DiscordActivityHandler,
)
from sentry.notifications.notification_action.activity_registry.email import EmailActivityHandler
from sentry.notifications.notification_action.activity_registry.msteams import (
    MSTeamsActivityHandler,
)
from sentry.notifications.notification_action.activity_registry.slack import SlackActivityHandler
from sentry.notifications.platform.target import IntegrationNotificationTarget
from sentry.notifications.platform.templates.activity import (
    ActivityNotificationData,
)
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationSource,
    NotificationTargetResourceType,
)
from sentry.types.activity import ActivityType
from sentry.utils.http import absolute_uri
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestCompatibleActivityTypes:
    def test_all_handlers_share_compatible_activity_types(self) -> None:
        for handler in [
            SlackActivityHandler,
            DiscordActivityHandler,
            MSTeamsActivityHandler,
            EmailActivityHandler,
        ]:
            for activity_type in NOTIFICATION_PLATFORM_COMPATIBLE_ACTIVITIES:
                assert activity_type in handler.compatible_activity_types


class TestBuildActivityData(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()
        self.workflow, self.detector, _, _ = self.create_detector_and_workflow()
        self.action = self.create_action()

    def test_build_activity_notification_data(self) -> None:
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
            notification_uuid="test-uuid",
        )

        data = build_activity_notification_data(invocation, activity)

        assert isinstance(data, ActivityNotificationData)
        assert data.source == NotificationSource.ACTIVITY_SEER_RCA_STARTED
        assert data.activity_type == ActivityType.SEER_RCA_STARTED.value
        assert data.notification_uuid == "test-uuid"
        assert data.issue_short_id == self.group.qualified_short_id
        assert data.issue_url == absolute_uri(self.group.get_absolute_url())
        assert data.issue_culprit == self.group.culprit
        assert data.alert_url is not None
        assert data.activity_data == activity.data


class TestSendActivityNotification(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()
        self.workflow, self.detector, _, _ = self.create_detector_and_workflow()
        self.action = self.create_action()

    @mock.patch(
        "sentry.notifications.notification_action.activity_registry.base.NotificationService"
    )
    def test_send_activity_notification(self, mock_service_cls: mock.MagicMock) -> None:
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
        target = IntegrationNotificationTarget(
            provider_key=NotificationProviderKey.SLACK,
            resource_type=NotificationTargetResourceType.CHANNEL,
            resource_id="C12345",
            integration_id=1,
            organization_id=self.organization.id,
        )

        send_activity_notification(invocation, activity, target)

        mock_subscripted = mock_service_cls.__getitem__.return_value
        mock_subscripted.assert_called_once()
        data = mock_subscripted.call_args[1]["data"]
        assert isinstance(data, ActivityNotificationData)

        mock_instance = mock_subscripted.return_value
        mock_instance.notify_sync.assert_called_once_with(targets=[target])
