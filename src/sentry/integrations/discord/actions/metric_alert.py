from __future__ import annotations
from typing import int

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
from sentry.workflow_engine.endpoints.serializers.detector_serializer import (
    DetectorSerializerResponse,
)

from ..utils import logger


def send_incident_alert_notification(
    organization: Organization,
    alert_context: AlertContext,
    notification_context: NotificationContext,
    metric_issue_context: MetricIssueContext,
    open_period_context: OpenPeriodContext,
    alert_rule_serialized_response: AlertRuleSerializerResponse | None,
    incident_serialized_response: DetailedIncidentSerializerResponse | None,
    detector_serialized_response: DetectorSerializerResponse | None = None,
    notification_uuid: str | None = None,
) -> bool:
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
        metric_issue_context=metric_issue_context,
        organization=organization,
        date_started=open_period_context.date_started,
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
