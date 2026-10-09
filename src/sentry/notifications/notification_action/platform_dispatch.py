import logging

import sentry_sdk

from sentry import features, options
from sentry.constants import METRIC_ALERTS_THREAD_DEFAULT
from sentry.incidents.charts import build_metric_alert_chart
from sentry.incidents.models.incident import IncidentStatus
from sentry.models.options.organization_option import OrganizationOption
from sentry.notifications.notification_action.metric_alert_registry.handlers.utils import (
    get_detector_serializer,
)
from sentry.notifications.notification_action.utils import metric_alert_notification_data_factory
from sentry.notifications.platform.service import NotificationService
from sentry.notifications.platform.shadow.capture import SHADOW_PROVIDERS
from sentry.notifications.platform.target import IntegrationNotificationTarget
from sentry.notifications.platform.templates.metric_alert import MetricAlertNotificationData
from sentry.notifications.platform.threading import ThreadingOptions, ThreadKey
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationSource,
    NotificationTargetResourceType,
)
from sentry.notifications.types import TEST_NOTIFICATION_ID
from sentry.notifications.utils.issue_notification_context import IssueNotificationContext
from sentry.workflow_engine.types import ActionInvocation

logger = logging.getLogger(__name__)

ALERT_PROVIDERS_OPTION = "notifications.platform.alert-providers"

SLACK_PROVIDERS = frozenset({NotificationProviderKey.SLACK, NotificationProviderKey.SLACK_STAGING})
CHART_PROVIDERS = SLACK_PROVIDERS | {NotificationProviderKey.DISCORD}


def get_platform_provider(
    invocation: ActionInvocation, source: NotificationSource
) -> NotificationProviderKey | None:
    """
    Returns the provider to send this alert through the notification platform, or None to keep the
    legacy send. Call once per invocation: the platform and legacy paths store threads separately.
    """
    provider = SHADOW_PROVIDERS.get(invocation.action.type)
    if (
        provider is None
        or invocation.workflow_id == TEST_NOTIFICATION_ID
        or invocation.action.id == TEST_NOTIFICATION_ID
        or provider not in options.get(ALERT_PROVIDERS_OPTION).get(source, [])
    ):
        return None

    organization = invocation.detector.linked_project.organization
    return provider if NotificationService.has_access(organization, source) else None


def send_metric_alert(context: IssueNotificationContext, provider: NotificationProviderKey) -> None:
    organization = context.organization
    notification_context = context.notification_context
    metric_issue_context = context.metric_issue_context
    open_period_context = context.open_period_context

    chart_url = None
    if provider in CHART_PROVIDERS and features.has(
        "organizations:metric-alert-chartcuterie", organization
    ):
        try:
            chart_url = build_metric_alert_chart(
                organization=organization,
                snuba_query=metric_issue_context.snuba_query,
                alert_context=context.alert_context,
                open_period_context=open_period_context,
                subscription=metric_issue_context.subscription,
                detector_serialized_response=get_detector_serializer(context.detector),
            )
        except Exception as e:
            sentry_sdk.capture_exception(e)

    data = metric_alert_notification_data_factory(context, chart_url=chart_url)
    assert notification_context.target_identifier is not None
    assert notification_context.integration_id is not None
    target = IntegrationNotificationTarget(
        provider_key=provider,
        resource_type=NotificationTargetResourceType.CHANNEL,
        resource_id=notification_context.target_identifier,
        integration_id=notification_context.integration_id,
        organization_id=organization.id,
    )

    threading_options = None
    if provider in SLACK_PROVIDERS and OrganizationOption.objects.get_value(
        organization=organization,
        key="sentry:issue_alerts_thread_flag",
        default=METRIC_ALERTS_THREAD_DEFAULT,
    ):
        threading_options = ThreadingOptions(
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

    errors = NotificationService[MetricAlertNotificationData](data=data).notify_sync(
        targets=[target], threading_options=threading_options
    )
    for failure in errors.get(provider, []):
        logger.warning(
            "notification_action.platform_dispatch.send_failed",
            extra={
                "action_id": notification_context.id,
                "group_id": metric_issue_context.id,
                "provider": provider,
                "status": failure.status.value,
            },
        )
