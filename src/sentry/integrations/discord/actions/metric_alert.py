from __future__ import annotations

import sentry_sdk

from sentry import features
from sentry.incidents.charts import build_metric_alert_chart
from sentry.incidents.models.alert_rule import AlertRuleTriggerAction
from sentry.incidents.models.incident import Incident, IncidentStatus
from sentry.integrations.discord.client import DiscordClient
from sentry.integrations.discord.message_builder.metric_alerts import (
    DiscordMetricAlertMessageBuilder,
)

from ..utils import logger


def send_incident_alert_notification(
    action: AlertRuleTriggerAction,
    incident: Incident,
    metric_value: float,
    new_status: IncidentStatus,
) -> bool:
    chart_url = None
    if features.has("organizations:metric-alert-chartcuterie", incident.organization):
        try:
            chart_url = build_metric_alert_chart(
                organization=incident.organization,
                alert_rule=incident.alert_rule,
                selected_incident=incident,
                subscription=incident.subscription,
            )
        except Exception as e:
            sentry_sdk.capture_exception(e)

    channel = action.target_identifier

    if not channel:
        # We can't send a message if we don't know the channel
        logger.warning(
            "discord.metric_alert.no_channel",
            extra={"incident_id": incident.id},
        )
        return False

    message = DiscordMetricAlertMessageBuilder(
        alert_rule=incident.alert_rule,
        incident=incident,
        new_status=new_status,
        metric_value=metric_value,
        chart_url=chart_url,
    )

    client = DiscordClient()
    try:
        client.send_message(channel, message)
    except Exception as error:
        logger.warning(
            "discord.metric_alert.message_send_failure",
            extra={"error": error, "incident_id": incident.id, "channel_id": channel},
        )
        return False
    else:
        return True
