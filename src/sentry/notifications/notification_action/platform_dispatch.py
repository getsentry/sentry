import logging

import sentry_sdk

from sentry import features, options
from sentry.constants import METRIC_ALERTS_THREAD_DEFAULT, ObjectStatus
from sentry.incidents.charts import build_metric_alert_chart
from sentry.incidents.models.incident import IncidentStatus
from sentry.integrations.services.integration.service import integration_service
from sentry.models.options.organization_option import OrganizationOption
from sentry.notifications.notification_action.metric_alert_registry.handlers.utils import (
    get_detector_serializer,
)
from sentry.notifications.notification_action.utils import metric_alert_notification_data_factory
from sentry.notifications.platform.provider import SendFailure
from sentry.notifications.platform.service import NotificationService
from sentry.notifications.platform.target import IntegrationNotificationTarget
from sentry.notifications.platform.templates.metric_alert import MetricAlertNotificationData
from sentry.notifications.platform.threading import (
    ThreadingLookup,
    ThreadingOptions,
    ThreadingService,
    ThreadKey,
)
from sentry.notifications.platform.types import (
    SHADOW_PROVIDERS,
    NotificationProviderKey,
    NotificationSource,
    NotificationTargetResourceType,
)
from sentry.notifications.types import TEST_NOTIFICATION_ID
from sentry.notifications.utils.issue_notification_context import IssueNotificationContext
from sentry.seer.entrypoints.slack.entrypoint import record_slack_thread_for_metric_open_period
from sentry.workflow_engine.types import ActionInvocation

logger = logging.getLogger(__name__)

ALERT_PROVIDERS_OPTION = "notifications.platform.alert-providers"

SLACK_PROVIDERS = frozenset({NotificationProviderKey.SLACK, NotificationProviderKey.SLACK_STAGING})

CHART_PROVIDERS = frozenset(
    {
        NotificationProviderKey.SLACK,
        NotificationProviderKey.SLACK_STAGING,
        NotificationProviderKey.DISCORD,
    }
)


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
        or not NotificationService.has_access(
            invocation.detector.linked_project.organization, source
        )
    ):
        return None
    return provider


def send_metric_alert(context: IssueNotificationContext, provider: NotificationProviderKey) -> None:
    organization = context.organization
    notification_context = context.notification_context
    metric_issue_context = context.metric_issue_context
    open_period_context = context.open_period_context

    # Match the legacy send: skip actions whose channel or integration is gone, rather than
    # raising and retrying on every alert.
    if (
        notification_context.integration_id is None
        or notification_context.target_identifier is None
    ):
        logger.warning(
            "notification_action.platform_dispatch.missing_target",
            extra={
                "action_id": notification_context.id,
                "integration_id": notification_context.integration_id,
                "target_identifier": notification_context.target_identifier,
                "provider": str(provider),
            },
        )
        return
    integration_context = integration_service.organization_context(
        organization_id=organization.id, integration_id=notification_context.integration_id
    )

    integration = integration_context.integration
    org_integration = integration_context.organization_integration

    if org_integration is None or integration is None or integration.status != ObjectStatus.ACTIVE:
        integration_status = integration.status if integration is not None else None
        logger.warning(
            "notification_action.platform_dispatch.integration_inactive",
            extra={
                "action_id": notification_context.id,
                "integration_id": notification_context.integration_id,
                "organization_id": organization.id,
                "provider": str(provider),
                "has_integration": integration is not None,
                "has_org_integration": org_integration is not None,
                "integration_status": integration_status,
            },
        )
        return

    target = IntegrationNotificationTarget(
        provider_key=provider,
        resource_type=NotificationTargetResourceType.CHANNEL,
        resource_id=notification_context.target_identifier,
        integration_id=notification_context.integration_id,
        organization_id=organization.id,
    )

    # for notifications that include a chart
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

    data = metric_alert_notification_data_factory(
        action_type=context.action_type,
        notification_context=notification_context,
        alert_context=context.alert_context,
        metric_issue_context=metric_issue_context,
        open_period_context=open_period_context,
        organization=organization,
        notification_uuid=context.notification_uuid,
        chart_url=chart_url,
    )

    # for notifications that have threads (just slack)
    threading_options = None
    if provider in SLACK_PROVIDERS and OrganizationOption.objects.get_value(
        organization=organization,
        key="sentry:metric_alerts_thread_flag",
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

    result = NotificationService[MetricAlertNotificationData](data=data).notify_target(
        target=target, threading_options=threading_options
    )
    if isinstance(result, SendFailure):
        logger.warning(
            "notification_action.platform_dispatch.send_failed",
            extra={
                "action_id": notification_context.id,
                "group_id": metric_issue_context.id,
                "provider": provider,
                "status": result.status.value,
            },
        )
        return

    if (
        data.show_investigation_button
        and provider in SLACK_PROVIDERS
        and result.provider_message_id is not None
    ):
        try:
            thread = None
            if threading_options is not None:
                thread = ThreadingService.resolve(
                    threading_lookup=ThreadingLookup(
                        key_type=threading_options.thread_key.key_type,
                        key_data=threading_options.thread_key.key_data,
                        provider_key=target.provider_key,
                        target_id=target.resource_id,
                    )
                )
            # Without a stored thread, the alert is a top-level message and starts its own thread.
            thread_ts = thread.thread_identifier if thread else result.provider_message_id
            record_slack_thread_for_metric_open_period(
                organization_id=organization.id,
                integration_id=target.integration_id,
                channel_id=target.resource_id,
                thread_ts=thread_ts,
                group_id=data.group_id,
                open_period_id=data.open_period_context.id,
            )
        except Exception as e:
            sentry_sdk.capture_exception(e)
