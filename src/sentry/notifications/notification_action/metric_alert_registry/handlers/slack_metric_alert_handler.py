import logging

import sentry_sdk

from sentry import features
from sentry.incidents.charts import build_metric_alert_chart
from sentry.incidents.endpoints.serializers.alert_rule import AlertRuleSerializerResponse
from sentry.incidents.endpoints.serializers.incident import DetailedIncidentSerializerResponse
from sentry.incidents.models.incident import IncidentStatus, TriggerStatus
from sentry.incidents.typings.metric_detector import (
    AlertContext,
    MetricIssueContext,
    NotificationContext,
    OpenPeriodContext,
)
from sentry.integrations.metric_alerts import incident_attachment_info
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.notifications.notification_action.metric_alert_registry.handlers.utils import (
    get_alert_rule_serializer,
    get_detailed_incident_serializer,
    get_detector_serializer,
)
from sentry.notifications.notification_action.registry import metric_alert_handler_registry
from sentry.notifications.notification_action.types import BaseMetricAlertHandler
from sentry.notifications.platform.service import NotificationService
from sentry.notifications.platform.target import IntegrationNotificationTarget
from sentry.notifications.platform.templates.metric_alert import MetricAlertNotificationData
from sentry.notifications.platform.threading import ThreadingOptions, ThreadKey
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationSource,
    NotificationTargetResourceType,
)
from sentry.workflow_engine.endpoints.serializers.detector_serializer import (
    DetectorSerializerResponse,
)
from sentry.workflow_engine.models import Action, Detector

logger = logging.getLogger(__name__)


def build_metric_alert_notification_data(
    notification_context: NotificationContext,
    metric_issue_context: MetricIssueContext,
    open_period_context: OpenPeriodContext,
    organization: Organization,
    notification_uuid: str,
    alert_rule_serialized_response: AlertRuleSerializerResponse | None,
    incident_serialized_response: DetailedIncidentSerializerResponse | None,
    detector_serialized_response: DetectorSerializerResponse | None,
    alert_context: AlertContext,
) -> MetricAlertNotificationData:
    attachment_info = incident_attachment_info(
        organization=organization,
        alert_context=alert_context,
        metric_issue_context=metric_issue_context,
        notification_uuid=notification_uuid,
        referrer="metric_alert_slack",
    )

    chart_url = None
    if (
        features.has("organizations:metric-alert-chartcuterie", organization)
        and alert_rule_serialized_response
        and incident_serialized_response
    ):
        try:
            chart_url = build_metric_alert_chart(
                organization=organization,
                alert_rule_serialized_response=alert_rule_serialized_response,
                snuba_query=metric_issue_context.snuba_query,
                alert_context=alert_context,
                open_period_context=open_period_context,
                selected_incident_serialized=incident_serialized_response,
                subscription=metric_issue_context.subscription,
                detector_serialized_response=detector_serialized_response,
            )
        except Exception as e:
            sentry_sdk.capture_exception(e)

    return MetricAlertNotificationData(
        group_id=metric_issue_context.id,
        organization_id=organization.id,
        notification_uuid=notification_uuid,
        action_id=notification_context.id,
        open_period_context=open_period_context,
        new_status=metric_issue_context.new_status.value,
        title=attachment_info["title"],
        title_link=attachment_info["title_link"],
        text=attachment_info["text"],
        chart_url=chart_url,
    )


def build_slack_notification_target(
    notification_context: NotificationContext,
    organization: Organization,
) -> IntegrationNotificationTarget:
    return IntegrationNotificationTarget(
        provider_key=NotificationProviderKey.SLACK,
        resource_type=NotificationTargetResourceType.CHANNEL,
        resource_id=notification_context.target_identifier,
        integration_id=notification_context.integration_id,
        organization_id=organization.id,
    )


def build_metric_alert_threading_options(
    notification_context: NotificationContext,
    metric_issue_context: MetricIssueContext,
    open_period_context: OpenPeriodContext,
) -> ThreadingOptions:
    return ThreadingOptions(
        thread_key=ThreadKey(
            key_type=NotificationSource.METRIC_ALERT,
            key_data={
                "action_id": notification_context.id,
                "group_id": metric_issue_context.id,
                "open_period_start": open_period_context.date_started.isoformat(),
            },
        ),
        reply_broadcast=(metric_issue_context.new_status == IncidentStatus.CRITICAL),
    )


@metric_alert_handler_registry.register(Action.Type.SLACK)
class SlackMetricAlertHandler(BaseMetricAlertHandler):
    @classmethod
    def send_alert(
        cls,
        notification_context: NotificationContext,
        alert_context: AlertContext,
        metric_issue_context: MetricIssueContext,
        open_period_context: OpenPeriodContext,
        trigger_status: TriggerStatus,
        notification_uuid: str,
        organization: Organization,
        project: Project,
    ) -> None:
        detector = Detector.objects.get(id=alert_context.action_identifier_id)
        if not detector:
            raise ValueError("Detector not found")

        open_period = GroupOpenPeriod.objects.get(id=open_period_context.id)
        if not open_period:
            raise ValueError("Open period not found")

        alert_rule_serialized_response = get_alert_rule_serializer(detector)
        detector_serialized_response = get_detector_serializer(detector)
        incident_serialized_response = get_detailed_incident_serializer(open_period)

        if notification_context.integration_id is None:
            raise ValueError("Slack integration_id is None")

        if notification_context.target_identifier is None:
            raise ValueError("Slack channel (target_identifier) is None")

        data = build_metric_alert_notification_data(
            notification_context=notification_context,
            metric_issue_context=metric_issue_context,
            open_period_context=open_period_context,
            organization=organization,
            notification_uuid=notification_uuid,
            alert_rule_serialized_response=alert_rule_serialized_response,
            incident_serialized_response=incident_serialized_response,
            detector_serialized_response=detector_serialized_response,
            alert_context=alert_context,
        )

        target = build_slack_notification_target(
            notification_context=notification_context,
            organization=organization,
        )

        threading_options = build_metric_alert_threading_options(
            notification_context=notification_context,
            metric_issue_context=metric_issue_context,
            open_period_context=open_period_context,
        )

        logger.info(
            "notification_action.execute_via_metric_alert_handler.slack",
            extra={
                "action_id": alert_context.action_identifier_id,
                "serialized_incident": incident_serialized_response,
                "serialized_alert_rule": alert_rule_serialized_response,
            },
        )

        NotificationService(data=data).notify_target(
            target=target, threading_options=threading_options
        )


@metric_alert_handler_registry.register(Action.Type.SLACK_STAGING)
class SlackStagingMetricAlertHandler(SlackMetricAlertHandler):
    pass
