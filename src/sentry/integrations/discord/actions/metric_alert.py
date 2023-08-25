from __future__ import annotations

import sentry_sdk

from sentry import features
from sentry.constants import ObjectStatus
from sentry.incidents.charts import build_metric_alert_chart
from sentry.incidents.models import AlertRuleTriggerAction, Incident, IncidentStatus
from sentry.integrations.discord.client import DiscordClient
from sentry.integrations.discord.message_builder.metric_alerts import (
    DiscordMetricAlertMessageBuilder,
)
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.shared_integrations.exceptions.base import ApiError

from ..utils import logger


def send_incident_alert_notification(
    action: AlertRuleTriggerAction,
    incident: Incident,
    metric_value: int,
    new_status: IncidentStatus,
) -> None:
    # Make sure organization integration is still active:
    integration, org_integration = integration_service.get_organization_context(
        organization_id=incident.organization_id, integration_id=action.integration_id
    )
    if org_integration is None or integration is None or integration.status != ObjectStatus.ACTIVE:
        # Integration removed, but rule is still active.
        return

    chart_url = None
    if features.has("organizations:metric-alert-chartcuterie", incident.organization):
        try:
            chart_url = build_metric_alert_chart(
                organization=incident.organization,
                alert_rule=incident.alert_rule,
                selected_incident=incident,
            )
        except Exception as e:
            sentry_sdk.capture_exception(e)

    channel = action.target_identifier

    if not channel:
        # We can't send a message if we don't know the channel
        logger.warning(
            "discord.metric_alert.message_send_failure",
            extra={"guild_id": integration.external_id, "channel_id": channel},
        )
        return

    message = DiscordMetricAlertMessageBuilder(
        incident,
        new_status,
        metric_value,
        chart_url,
    )

    client = DiscordClient(integration_id=integration.id)
    try:
        client.send_message(channel, message)
    except ApiError as error:
        logger.warning(
            "discord.metric_alert.messsage_send_failure",
            extra={"error": error, "guild_id": integration.external_id, "channel_id": channel},
        )
