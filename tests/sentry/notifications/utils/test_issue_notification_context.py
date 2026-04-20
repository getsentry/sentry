import uuid
from dataclasses import asdict

from sentry.incidents.models.alert_rule import AlertRuleThresholdType
from sentry.incidents.typings.metric_detector import AlertContext, NotificationContext
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.utils.issue_notification_context import IssueNotificationContext
from sentry.seer.anomaly_detection.types import AnomalyDetectionThresholdType
from sentry.testutils.skips import requires_snuba
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation, WorkflowEventData
from tests.sentry.notifications.notification_action.test_metric_alert_registry_handlers import (
    MetricAlertHandlerBase,
)

pytestmark = [requires_snuba]


class TestIssueNotificationContext(MetricAlertHandlerBase):
    def setUp(self) -> None:
        super().setUp()
        self.action = self.create_action(
            type=Action.Type.DISCORD,
            integration_id="1234567890",
            config={"target_identifier": "channel456", "target_type": ActionTarget.SPECIFIC},
            data={"tags": "environment,user,my_tag"},
        )

    def _make_context(self, group_event=None) -> IssueNotificationContext:
        event_data = self.event_data
        if group_event is not None:
            event_data = WorkflowEventData(
                event=group_event,
                workflow_env=self.workflow.environment,
                group=group_event.group,
            )
        invocation = ActionInvocation(
            event_data=event_data,
            action=self.action,
            detector=self.detector,
            notification_uuid=str(uuid.uuid4()),
        )
        return IssueNotificationContext(invocation)

    def test_notification_context(self) -> None:
        ctx = self._make_context()
        notification_context = ctx.notification_context

        assert isinstance(notification_context, NotificationContext)
        assert notification_context.target_identifier == "channel456"
        assert notification_context.integration_id == "1234567890"
        assert notification_context.sentry_app_config is None

    def test_alert_context(self) -> None:
        ctx = self._make_context()
        alert_context = ctx.alert_context

        assert isinstance(alert_context, AlertContext)
        assert alert_context.name == self.detector.name
        assert alert_context.action_identifier_id == self.detector.id
        assert alert_context.threshold_type == AlertRuleThresholdType.ABOVE
        assert alert_context.comparison_delta is None

    def test_alert_context_anomaly_detection(self) -> None:
        _, _, anomaly_group_event = self.create_group_event(
            occurrence=self.create_issue_occurrence(
                priority=PriorityLevel.HIGH.value,
                level="error",
                evidence_data=asdict(self.anomaly_detection_evidence_data),
            ),
        )

        ctx = self._make_context(group_event=anomaly_group_event)
        alert_context = ctx.alert_context

        assert isinstance(alert_context, AlertContext)
        assert alert_context.name == self.detector.name
        assert alert_context.action_identifier_id == self.detector.id
        assert alert_context.threshold_type == AnomalyDetectionThresholdType.ABOVE_AND_BELOW
        assert alert_context.comparison_delta is None
        assert alert_context.alert_threshold == 0
        assert alert_context.resolve_threshold == 0
