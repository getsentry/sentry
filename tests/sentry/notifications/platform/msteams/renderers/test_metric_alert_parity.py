from __future__ import annotations

from sentry.incidents.typings.metric_detector import (
    AlertContext,
    MetricIssueContext,
    OpenPeriodContext,
)
from sentry.integrations.metric_alerts import get_status_text, incident_attachment_info
from sentry.integrations.msteams.card_builder.block import AdaptiveCard
from sentry.integrations.msteams.card_builder.incident_attachment import build_incident_attachment
from sentry.models.group import GroupStatus
from sentry.notifications.platform.msteams.provider import MSTeamsNotificationProvider
from sentry.notifications.platform.msteams.renderers.metric_alert import (
    MSTeamsMetricAlertRenderer,
)
from sentry.notifications.platform.templates.metric_alert import MetricAlertNotificationData
from sentry.notifications.platform.types import NotificationRenderedTemplate
from sentry.workflow_engine.types import DetectorPriorityLevel
from tests.sentry.notifications.notification_action.test_metric_alert_registry_handlers import (
    MetricAlertHandlerBase,
)

NOTIFICATION_UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"


class MetricAlertCardLegacyParityTest(MetricAlertHandlerBase):
    """
    The platform renderer must produce the same card as the legacy metric alert card builder for
    every incident status, so that the cutover is invisible to users.
    """

    def build_contexts(
        self, priority: DetectorPriorityLevel
    ) -> tuple[AlertContext, MetricIssueContext, OpenPeriodContext]:
        alert_context = AlertContext.from_workflow_engine_models(
            self.detector, self.evidence_data, self.group.status, priority
        )
        metric_issue_context = MetricIssueContext.from_group_event(
            self.group, self.evidence_data, priority
        )
        open_period_context = OpenPeriodContext.from_group(self.group)
        return alert_context, metric_issue_context, open_period_context

    def legacy_card(
        self,
        alert_context: AlertContext,
        metric_issue_context: MetricIssueContext,
        open_period_context: OpenPeriodContext,
    ) -> AdaptiveCard:
        return build_incident_attachment(
            alert_context=alert_context,
            metric_issue_context=metric_issue_context,
            organization=self.organization,
            date_started=open_period_context.date_started,
            notification_uuid=NOTIFICATION_UUID,
        )

    def platform_card(
        self,
        alert_context: AlertContext,
        metric_issue_context: MetricIssueContext,
        open_period_context: OpenPeriodContext,
    ) -> AdaptiveCard:
        attachment_info = incident_attachment_info(
            organization=self.organization,
            alert_context=alert_context,
            metric_issue_context=metric_issue_context,
            notification_uuid=NOTIFICATION_UUID,
            referrer="metric_alert_msteams",
        )
        data = MetricAlertNotificationData(
            group_id=metric_issue_context.id,
            organization_id=self.organization.id,
            notification_uuid=NOTIFICATION_UUID,
            action_id=1,
            open_period_context=open_period_context,
            new_status=metric_issue_context.new_status.value,
            title=attachment_info["title"],
            title_link=attachment_info["title_link"],
            text=attachment_info["text"],
        )
        assert MSTeamsNotificationProvider.get_renderer(data=data) is MSTeamsMetricAlertRenderer
        return MSTeamsMetricAlertRenderer.render(
            data=data,
            rendered_template=NotificationRenderedTemplate(subject="Metric Alert", body=[]),
        )

    def assert_parity(self, priority: DetectorPriorityLevel, expected_status: str) -> None:
        contexts = self.build_contexts(priority)
        assert get_status_text(contexts[1].new_status) == expected_status
        assert self.legacy_card(*contexts) == self.platform_card(*contexts)

    def test_parity_for_critical(self) -> None:
        self.assert_parity(DetectorPriorityLevel.HIGH, "Critical")

    def test_parity_for_warning(self) -> None:
        self.assert_parity(DetectorPriorityLevel.MEDIUM, "Warning")

    def test_parity_for_resolved(self) -> None:
        self.group.update(status=GroupStatus.RESOLVED, substatus=None)
        self.assert_parity(DetectorPriorityLevel.OK, "Resolved")

    def test_parity_with_anomaly_detection_feature(self) -> None:
        with self.feature("organizations:anomaly-detection-alerts"):
            self.assert_parity(DetectorPriorityLevel.HIGH, "Critical")
