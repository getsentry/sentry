import uuid
from dataclasses import asdict
from unittest import mock

import pytest

from sentry.grouping.grouptype import ErrorGroupType
from sentry.models.activity import Activity
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.notification_action.issue_notification_dispatcher import (
    IssueNotificationDispatcher,
    NotificationDispatcherError,
)
from sentry.notifications.platform.service import NotificationService
from sentry.notifications.platform.target import IntegrationNotificationTarget
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationSource,
    NotificationTargetResourceType,
)
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation, WorkflowEventData
from tests.sentry.notifications.notification_action.test_metric_alert_registry_handlers import (
    MetricAlertHandlerBase,
)

pytestmark = [requires_snuba]


class TestIssueNotificationDispatcher(MetricAlertHandlerBase):
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="slack",
            external_id="slack_ext_id",
        )
        self.action = self.create_action(
            type=Action.Type.SLACK,
            integration_id=self.integration.id,
            config={
                "target_identifier": "C12345",
                "target_display": "#test-channel",
                "target_type": ActionTarget.SPECIFIC,
            },
            data={"tags": "environment,user", "notes": "test note"},
        )
        # Link action to workflow (workflow_id is annotated dynamically in production)
        self.create_workflow_action(workflow=self.workflow, action=self.action)

    def _create_metric_alert_invocation(self) -> ActionInvocation:
        """Create an invocation for a metric alert (Activity-based, resolved)."""
        activity = Activity.objects.create(
            project=self.project,
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            data=asdict(self.evidence_data),
        )
        event_data = WorkflowEventData(
            event=activity,
            workflow_env=self.workflow.environment,
            group=self.group,
        )
        return ActionInvocation(
            event_data=event_data,
            action=self.action,
            detector=self.detector,
            notification_uuid=str(uuid.uuid4()),
        )

    def _create_issue_alert_invocation(self) -> ActionInvocation:
        """Create an invocation for an issue alert (GroupEvent-based, error detector)."""
        _, detector, _, _ = self.create_detector_and_workflow(
            name_prefix="error",
            detector_type=ErrorGroupType.slug,
        )
        group, _, group_event = self.create_group_event()
        event_data = WorkflowEventData(
            event=group_event,
            workflow_env=self.workflow.environment,
            group=group,
        )
        action = Action.objects.get(id=self.action.id)
        action.workflow_id = self.workflow.id  # Normally annotated by queryset in production
        return ActionInvocation(
            event_data=event_data,
            action=action,
            detector=detector,
            notification_uuid=str(uuid.uuid4()),
        )

    def _assert_integration_target(
        self,
        target: IntegrationNotificationTarget,
        provider_key: NotificationProviderKey,
        resource_id: str,
        integration_id: int,
    ) -> None:
        assert isinstance(target, IntegrationNotificationTarget)
        assert target.provider_key == provider_key
        assert target.resource_type == NotificationTargetResourceType.CHANNEL
        assert target.resource_id == resource_id
        assert target.integration_id == integration_id
        assert target.organization_id == self.organization.id

    @mock.patch.object(NotificationService, "has_access", return_value=True)
    @mock.patch.object(NotificationService, "notify_sync", return_value={})
    def test_dispatch(self, mock_notify_sync, mock_has_access) -> None:
        invocation = self._create_metric_alert_invocation()
        dispatcher = IssueNotificationDispatcher(invocation)
        dispatcher.dispatch()
        assert mock_notify_sync.call_count == 1

    def test_rejects_notification_for_non_enabled_providers(self) -> None:
        pagerduty_action = self.create_action(
            type=Action.Type.PAGERDUTY,
            integration_id=self.integration.id,
            config={
                "target_identifier": "pd_service_key",
                "target_type": ActionTarget.SPECIFIC,
            },
            data={},
        )
        invocation = ActionInvocation(
            event_data=self.event_data,
            action=pagerduty_action,
            detector=self.detector,
            notification_uuid=str(uuid.uuid4()),
        )
        dispatcher = IssueNotificationDispatcher(invocation)
        with pytest.raises(NotificationDispatcherError):
            dispatcher.dispatch()

    @mock.patch.object(NotificationService, "has_access", return_value=False)
    def test_rejects_notification_when_has_access_returns_false(self, mock_has_access) -> None:
        invocation = self._create_metric_alert_invocation()
        dispatcher = IssueNotificationDispatcher(invocation)
        with pytest.raises(NotificationDispatcherError):
            dispatcher.dispatch()

    def test_should_send_returns_false_when_action_type_is_empty(self) -> None:
        action = Action.objects.get(id=self.action.id)
        action.type = ""
        invocation = ActionInvocation(
            event_data=self.event_data,
            action=action,
            detector=self.detector,
            notification_uuid=str(uuid.uuid4()),
        )
        dispatcher = IssueNotificationDispatcher(invocation)
        assert dispatcher.should_send_via_notification_platform() is False

    def test_correctly_classifies_metric_alert_notification(self) -> None:
        invocation = self._create_metric_alert_invocation()
        dispatcher = IssueNotificationDispatcher(invocation)
        assert dispatcher._is_metric_issue_action_invocation() is True

    def test_correctly_classifies_issue_alert_notification(self) -> None:
        invocation = self._create_issue_alert_invocation()
        dispatcher = IssueNotificationDispatcher(invocation)
        assert dispatcher._is_metric_issue_action_invocation() is False
        assert dispatcher._is_issue_action_invocation() is True

    def test_group_event_with_metric_group_is_not_metric_invocation(self) -> None:
        """A GroupEvent (not Activity) is never classified as a metric alert, even with MetricIssue group type."""
        invocation = ActionInvocation(
            event_data=self.event_data,  # GroupEvent-based
            action=self.action,
            detector=self.detector,
            notification_uuid=str(uuid.uuid4()),
        )
        dispatcher = IssueNotificationDispatcher(invocation)
        assert dispatcher._is_metric_issue_action_invocation() is False

    def test_non_set_resolved_activity_with_metric_detector_is_not_metric(self) -> None:
        """An Activity with a non-SET_RESOLVED type should not classify as metric, even with a MetricIssue detector."""
        activity = Activity.objects.create(
            project=self.project,
            group=self.group,
            type=ActivityType.SET_IGNORED.value,
            data={},
        )
        event_data = WorkflowEventData(
            event=activity,
            workflow_env=self.workflow.environment,
            group=self.group,
        )
        invocation = ActionInvocation(
            event_data=event_data,
            action=self.action,
            detector=self.detector,  # MetricIssue.slug type
            notification_uuid=str(uuid.uuid4()),
        )
        dispatcher = IssueNotificationDispatcher(invocation)
        assert dispatcher._is_metric_issue_action_invocation() is False

    def test_activity_with_non_metric_group_and_detector_is_not_metric(self) -> None:
        """Activity with SET_RESOLVED but non-metric group type and detector returns False."""
        _, error_detector, _, _ = self.create_detector_and_workflow(
            name_prefix="error",
            detector_type=ErrorGroupType.slug,
        )
        group, _, _ = self.create_group_event()  # default error group type
        activity = Activity.objects.create(
            project=self.project,
            group=group,
            type=ActivityType.SET_RESOLVED.value,
            data={},
        )
        event_data = WorkflowEventData(
            event=activity,
            workflow_env=self.workflow.environment,
            group=group,
        )
        invocation = ActionInvocation(
            event_data=event_data,
            action=self.action,
            detector=error_detector,
            notification_uuid=str(uuid.uuid4()),
        )
        dispatcher = IssueNotificationDispatcher(invocation)
        assert dispatcher._is_metric_issue_action_invocation() is False

    @mock.patch.object(NotificationService, "has_access", return_value=True)
    @mock.patch.object(NotificationService, "notify_sync", return_value={})
    def test_correctly_dispatches_metric_alert_notification(
        self, mock_notify_sync, mock_has_access
    ) -> None:
        invocation = self._create_metric_alert_invocation()
        dispatcher = IssueNotificationDispatcher(invocation)
        dispatcher.dispatch()

        assert mock_notify_sync.call_count == 1
        _, kwargs = mock_notify_sync.call_args

        assert len(kwargs["targets"]) == 1
        self._assert_integration_target(
            kwargs["targets"][0], NotificationProviderKey.SLACK, "C12345", self.integration.id
        )

        threading_options = kwargs["threading_options"]
        assert threading_options is not None
        thread_key = threading_options.thread_key
        assert thread_key.key_type == NotificationSource.METRIC_ALERT
        assert thread_key.key_data["action_id"] == self.action.id
        assert thread_key.key_data["group_id"] == invocation.event_data.group.id
        assert "open_period_start" in thread_key.key_data

    @mock.patch.object(NotificationService, "has_access", return_value=True)
    @mock.patch.object(NotificationService, "notify_sync", return_value={})
    def test_correctly_dispatches_issue_alert_notification(
        self, mock_notify_sync, mock_has_access
    ) -> None:
        invocation = self._create_issue_alert_invocation()
        dispatcher = IssueNotificationDispatcher(invocation)
        dispatcher.dispatch()

        assert mock_notify_sync.call_count == 1
        _, kwargs = mock_notify_sync.call_args

        assert len(kwargs["targets"]) == 1
        self._assert_integration_target(
            kwargs["targets"][0], NotificationProviderKey.SLACK, "C12345", self.integration.id
        )

        threading_options = kwargs.get("threading_options")
        assert threading_options is not None
        assert threading_options.thread_key.key_type == NotificationSource.ISSUE
        assert threading_options.thread_key.key_data["action_id"] == self.action.id
        assert threading_options.thread_key.key_data["group_id"] == invocation.event_data.group.id
        assert threading_options.reply_broadcast is False

    def test_extract_notification_target(self) -> None:
        invocation = self._create_metric_alert_invocation()
        dispatcher = IssueNotificationDispatcher(invocation)
        target = dispatcher._extract_notification_target()
        self._assert_integration_target(
            target, NotificationProviderKey.SLACK, "C12345", self.integration.id
        )

    def test_metric_alert_thread_key(self) -> None:
        invocation = self._create_metric_alert_invocation()
        dispatcher = IssueNotificationDispatcher(invocation)
        thread_key = dispatcher._get_metric_alert_thread_key()

        assert thread_key.key_type == NotificationSource.METRIC_ALERT
        assert thread_key.key_data["action_id"] == self.action.id
        assert thread_key.key_data["group_id"] == self.group.id
        open_period_start = thread_key.key_data["open_period_start"]
        assert isinstance(open_period_start, str)
        assert self.open_period.date_started.isoformat() == open_period_start

    def test_issue_alert_thread_key(self) -> None:
        invocation = self._create_issue_alert_invocation()
        dispatcher = IssueNotificationDispatcher(invocation)
        thread_key = dispatcher._get_issue_alert_thread_key()

        assert thread_key.key_type == NotificationSource.ISSUE
        assert thread_key.key_data["action_id"] == self.action.id
        assert thread_key.key_data["group_id"] == invocation.event_data.group.id

    @mock.patch.object(NotificationService, "has_access", return_value=True)
    @mock.patch.object(NotificationService, "notify_sync", return_value={})
    def test_dispatch_with_discord_provider(self, mock_notify_sync, mock_has_access) -> None:
        discord_integration = self.create_integration(
            organization=self.organization,
            provider="discord",
            external_id="discord_ext_id",
        )
        discord_action = self.create_action(
            type=Action.Type.DISCORD,
            integration_id=discord_integration.id,
            config={
                "target_identifier": "discord_channel_123",
                "target_type": ActionTarget.SPECIFIC,
            },
            data={"tags": "environment"},
        )
        activity = Activity.objects.create(
            project=self.project,
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            data=asdict(self.evidence_data),
        )
        event_data = WorkflowEventData(
            event=activity,
            workflow_env=self.workflow.environment,
            group=self.group,
        )
        invocation = ActionInvocation(
            event_data=event_data,
            action=discord_action,
            detector=self.detector,
            notification_uuid=str(uuid.uuid4()),
        )
        dispatcher = IssueNotificationDispatcher(invocation)
        dispatcher.dispatch()

        assert mock_notify_sync.call_count == 1
        _, kwargs = mock_notify_sync.call_args
        target = kwargs["targets"][0]
        assert target.provider_key == NotificationProviderKey.DISCORD
        assert target.resource_id == "discord_channel_123"
        assert target.integration_id == discord_integration.id
