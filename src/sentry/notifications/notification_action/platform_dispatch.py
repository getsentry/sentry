import logging
from typing import Any

import sentry_sdk

from sentry import analytics, features, options
from sentry.analytics.events.alert_sent import AlertSentEvent
from sentry.analytics.events.base_notification_sent import BaseNotificationSent
from sentry.constants import ISSUE_ALERTS_THREAD_DEFAULT, METRIC_ALERTS_THREAD_DEFAULT, ObjectStatus
from sentry.incidents.charts import build_metric_alert_chart
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.incident import IncidentStatus
from sentry.incidents.typings.metric_detector import NotificationContext
from sentry.integrations.discord.analytics import DiscordIntegrationNotificationSent
from sentry.integrations.msteams.analytics import MSTeamsIntegrationNotificationSent
from sentry.integrations.services.integration.service import integration_service
from sentry.integrations.slack.analytics import SlackIntegrationNotificationSent
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.organization import Organization
from sentry.notifications.notification_action.metric_alert_registry.handlers.utils import (
    get_detector_serializer,
)
from sentry.notifications.notification_action.utils import (
    issue_notification_data_factory,
    metric_alert_notification_data_factory,
)
from sentry.notifications.platform.provider import SendFailure, SendSuccessResult
from sentry.notifications.platform.service import NotificationService
from sentry.notifications.platform.target import IntegrationNotificationTarget
from sentry.notifications.platform.threading import ThreadingOptions, ThreadKey
from sentry.notifications.platform.types import (
    SHADOW_PROVIDERS,
    SLACK_PROVIDERS,
    NotificationData,
    NotificationProviderKey,
    NotificationSource,
    NotificationTargetResourceType,
)
from sentry.notifications.types import TEST_NOTIFICATION_ID
from sentry.notifications.utils.issue_notification_context import IssueNotificationContext
from sentry.notifications.utils.open_period import open_period_start_for_group
from sentry.seer.entrypoints.operator import SeerAutofixOperator
from sentry.seer.entrypoints.slack.entrypoint import prepare_slack_thread_for_autofix_updates
from sentry.seer.entrypoints.types import SeerEntrypointKey
from sentry.uptime.grouptype import UptimeDomainCheckFailure
from sentry.utils import metrics
from sentry.workflow_engine.types import ActionInvocation

logger = logging.getLogger(__name__)

ALERT_PROVIDERS_OPTION = "notifications.platform.alert-providers"

CHART_PROVIDERS = frozenset(
    {
        NotificationProviderKey.SLACK,
        NotificationProviderKey.SLACK_STAGING,
        NotificationProviderKey.DISCORD,
    }
)

# The legacy issue alert analytics per provider: (provider name, sent event, metric instance)
LEGACY_ISSUE_ALERT_ANALYTICS: dict[
    NotificationProviderKey, tuple[str, type[BaseNotificationSent], str]
] = {
    NotificationProviderKey.SLACK: (
        "slack",
        SlackIntegrationNotificationSent,
        "slack.notification",
    ),
    NotificationProviderKey.SLACK_STAGING: (
        "slack",
        SlackIntegrationNotificationSent,
        "slack.notification",
    ),
    NotificationProviderKey.DISCORD: (
        "discord",
        DiscordIntegrationNotificationSent,
        "discord.notifications",
    ),
    NotificationProviderKey.MSTEAMS: (
        "msteams",
        MSTeamsIntegrationNotificationSent,
        "msteams.notification",
    ),
}


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


def _build_target(
    provider: NotificationProviderKey,
    organization: Organization,
    notification_context: NotificationContext,
) -> IntegrationNotificationTarget | None:
    # Match the legacy sends: skip actions whose channel or integration is gone, rather than
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
        return None
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
        return None

    return IntegrationNotificationTarget(
        provider_key=provider,
        resource_type=NotificationTargetResourceType.CHANNEL,
        resource_id=notification_context.target_identifier,
        integration_id=notification_context.integration_id,
        organization_id=organization.id,
    )


def _should_thread(
    provider: NotificationProviderKey, organization: Organization, key: str, default: bool
) -> bool:
    # for notifications that have threads (just slack)
    return provider in SLACK_PROVIDERS and OrganizationOption.objects.get_value(
        organization=organization, key=key, default=default
    )


def _send(
    data: NotificationData,
    target: IntegrationNotificationTarget,
    threading_options: ThreadingOptions | None,
    action_id: int,
    group_id: int,
) -> SendSuccessResult | SendFailure:
    service = NotificationService(data=data)
    result = service.notify_target(target=target, threading_options=threading_options)

    if isinstance(result, SendFailure):
        logger.warning(
            "notification_action.platform_dispatch.send_failed",
            extra={
                "action_id": action_id,
                "group_id": group_id,
                "provider": target.provider_key,
                "status": result.status.value,
            },
        )

    return result


def send_metric_alert(context: IssueNotificationContext, provider: NotificationProviderKey) -> None:
    organization = context.organization
    notification_context = context.notification_context
    metric_issue_context = context.metric_issue_context
    open_period_context = context.open_period_context

    target = _build_target(provider, organization, notification_context)
    if target is None:
        return

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

    threading_options = None
    if _should_thread(
        provider, organization, "sentry:metric_alerts_thread_flag", METRIC_ALERTS_THREAD_DEFAULT
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

    _send(data, target, threading_options, notification_context.id, metric_issue_context.id)


def send_issue_alert(invocation: ActionInvocation, provider: NotificationProviderKey) -> None:
    group = invocation.event_data.group
    organization = group.project.organization

    target = _build_target(
        provider, organization, NotificationContext.from_action_model(invocation.action)
    )
    if target is None:
        return

    # Same thread as the legacy send: one per action and issue, plus the open period for uptime
    # and metric issues.
    threading_options = None
    if _should_thread(
        provider, organization, "sentry:issue_alerts_thread_flag", ISSUE_ALERTS_THREAD_DEFAULT
    ):
        key_data: dict[str, Any] = {"action_id": invocation.action.id, "group_id": group.id}
        if group.issue_type.type_id in (UptimeDomainCheckFailure.type_id, MetricIssue.type_id):
            open_period_start = open_period_start_for_group(group)
            key_data["open_period_start"] = (
                open_period_start.isoformat() if open_period_start else None
            )
        threading_options = ThreadingOptions(
            thread_key=ThreadKey(key_type=NotificationSource.ISSUE, key_data=key_data),
            reply_broadcast=True,
        )

    result = _send(
        issue_notification_data_factory(invocation),
        target,
        threading_options,
        invocation.action.id,
        group.id,
    )
    _record_legacy_issue_alert_sent(invocation, provider, target.resource_id)

    # Cache the thread for Seer autofix updates
    if not (
        isinstance(result, SendSuccessResult)
        and result.provider_message_id
        and provider in SLACK_PROVIDERS
        and SeerAutofixOperator.has_access(
            organization=organization, entrypoint_key=SeerEntrypointKey.SLACK
        )
    ):
        return

    # A threaded reply returns its own ts; Seer needs the root ts, like the legacy send.
    thread_ts = result.thread_identifier or result.provider_message_id
    prepare_slack_thread_for_autofix_updates(
        thread_ts=thread_ts,
        channel_id=target.resource_id,
        group=group,
        organization_id=organization.id,
        integration_id=target.integration_id,
    )


def _record_legacy_issue_alert_sent(
    invocation: ActionInvocation, provider: NotificationProviderKey, channel_id: str
) -> None:
    """
    Keep the legacy issue alert analytics and metric during the migration, recorded whether or not
    the send succeeded like the legacy sends. Remove with the legacy path.
    """
    provider_name, sent_event_class, metric_instance = LEGACY_ISSUE_ALERT_ANALYTICS[provider]
    group = invocation.event_data.group
    metrics.incr(
        "notifications.sent",
        instance=metric_instance,
        tags={"issue_type": group.issue_type.slug},
        skip_internal=False,
    )
    try:
        analytics.record(
            sent_event_class(
                organization_id=group.project.organization_id,
                project_id=group.project_id,
                group_id=group.id,
                notification_uuid=invocation.notification_uuid,
                alert_id=invocation.action.id,
                category="issue_alert",
            )
        )
        analytics.record(
            AlertSentEvent(
                provider=provider_name,
                alert_id=invocation.action.id,
                alert_type="issue_alert",
                organization_id=group.project.organization_id,
                project_id=group.project_id,
                external_id=channel_id,
                notification_uuid=invocation.notification_uuid,
            )
        )
    except Exception as e:
        sentry_sdk.capture_exception(e)
