from __future__ import annotations

from sentry.incidents.charts import build_metric_alert_notification_chart
from sentry.incidents.typings.metric_detector import (
    AlertContext,
    MetricIssueContext,
    NotificationContext,
    OpenPeriodContext,
)
from sentry.integrations.discord.client import DiscordClient
from sentry.integrations.discord.message_builder.base.base import DiscordMessage
from sentry.integrations.discord.message_builder.metric_alerts import (
    DiscordMetricAlertMessageBuilder,
)
from sentry.integrations.discord.spec import DiscordMessagingSpec
from sentry.integrations.discord.utils.metrics import record_lifecycle_termination_level
from sentry.integrations.messaging.metrics import (
    MessagingInteractionEvent,
    MessagingInteractionType,
)
from sentry.models.organization import Organization
from sentry.notifications.platform.shadow.capture import record_legacy_render
from sentry.notifications.platform.types import NotificationProviderKey
from sentry.shared_integrations.exceptions import ApiError
from sentry.workflow_engine.endpoints.serializers.detector_serializer import (
    DetectorSerializerResponse,
)

from ..utils import logger


def build_metric_alert_message(
    organization: Organization,
    alert_context: AlertContext,
    metric_issue_context: MetricIssueContext,
    open_period_context: OpenPeriodContext,
    chart_url: str | None,
    notification_uuid: str | None,
) -> DiscordMessage:
    return DiscordMetricAlertMessageBuilder(
        alert_context=alert_context,
        metric_issue_context=metric_issue_context,
        organization=organization,
        date_started=open_period_context.date_started,
        chart_url=chart_url,
    ).build(notification_uuid=notification_uuid)


def send_incident_alert_notification(
    organization: Organization,
    alert_context: AlertContext,
    notification_context: NotificationContext,
    metric_issue_context: MetricIssueContext,
    open_period_context: OpenPeriodContext,
    detector_serialized_response: DetectorSerializerResponse | None = None,
    notification_uuid: str | None = None,
) -> bool:
    chart_url = build_metric_alert_notification_chart(
        organization=organization,
        alert_context=alert_context,
        metric_issue_context=metric_issue_context,
        open_period_context=open_period_context,
        detector_serialized_response=detector_serialized_response,
    )

    channel = notification_context.target_identifier

    if not channel:
        # We can't send a message if we don't know the channel
        logger.warning(
            "discord.metric_alert.no_channel",
            extra={"incident_id": metric_issue_context.id},
        )
        return False

    message = build_metric_alert_message(
        organization=organization,
        alert_context=alert_context,
        metric_issue_context=metric_issue_context,
        open_period_context=open_period_context,
        chart_url=chart_url,
        notification_uuid=notification_uuid,
    )
    record_legacy_render(NotificationProviderKey.DISCORD, message, chart_url=chart_url)

    client = DiscordClient()
    with MessagingInteractionEvent(
        interaction_type=MessagingInteractionType.SEND_INCIDENT_ALERT_NOTIFICATION,
        spec=DiscordMessagingSpec(),
    ).capture() as lifecycle:
        try:
            client.send_message(channel, message)
        except ApiError as error:
            # Errors that we recieve from the Discord API
            record_lifecycle_termination_level(lifecycle, error)
            return False
        except Exception as error:
            lifecycle.add_extras(
                {
                    "incident_id": metric_issue_context.id,
                    "channel_id": channel,
                }
            )

            lifecycle.record_failure(error)
            return False
        return True
