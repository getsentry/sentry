from __future__ import annotations

import sentry_sdk

from sentry import features
from sentry.incidents.charts import build_metric_alert_chart
from sentry.incidents.endpoints.serializers.alert_rule import AlertRuleSerializerResponse
from sentry.incidents.endpoints.serializers.incident import DetailedIncidentSerializerResponse
from sentry.incidents.typings.metric_detector import (
    AlertContext,
    MetricIssueContext,
    NotificationContext,
    OpenPeriodContext,
)
from sentry.integrations.discord.client import DiscordClient
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
from sentry.shared_integrations.exceptions import ApiError

from ..utils import logger


def send_incident_alert_notification(
    organization: Organization,
    alert_context: AlertContext,
    notification_context: NotificationContext,
    metric_issue_context: MetricIssueContext,
    open_period_context: OpenPeriodContext,
    alert_rule_serialized_response: AlertRuleSerializerResponse,
    incident_serialized_response: DetailedIncidentSerializerResponse,
    notification_uuid: str | None = None,
) -> bool:
    chart_url = None
    if features.has("organizations:metric-alert-chartcuterie", organization):
        try:
            chart_url = build_metric_alert_chart(
                organization=organization,
                alert_rule_serialized_response=alert_rule_serialized_response,
                snuba_query=metric_issue_context.snuba_query,
                alert_context=alert_context,
                open_period_context=open_period_context,
                selected_incident_serialized=incident_serialized_response,
                subscription=metric_issue_context.subscription,
            )
        except Exception as e:
            sentry_sdk.capture_exception(e)

    channel = notification_context.target_identifier

    if not channel:
        # We can't send a message if we don't know the channel
        logger.warning(
            "discord.metric_alert.no_channel",
            extra={"incident_id": metric_issue_context.id},
        )
        return False

    message = DiscordMetricAlertMessageBuilder(
        alert_context=alert_context,
        open_period_identifier=metric_issue_context.open_period_identifier,
        snuba_query=metric_issue_context.snuba_query,
        organization=organization,
        date_started=open_period_context.date_started,
        new_status=metric_issue_context.new_status,
        metric_value=metric_issue_context.metric_value,
        chart_url=chart_url,
    ).build(notification_uuid=notification_uuid)

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
