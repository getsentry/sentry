from __future__ import annotations

import time
from datetime import datetime

from sentry.incidents.models.alert_rule import AlertRule
from sentry.incidents.models.incident import Incident, IncidentStatus
from sentry.integrations.discord.message_builder import INCIDENT_COLOR_MAPPING, LEVEL_TO_COLOR
from sentry.integrations.discord.message_builder.base.base import DiscordMessageBuilder
from sentry.integrations.discord.message_builder.base.embed.base import DiscordMessageEmbed
from sentry.integrations.discord.message_builder.base.embed.image import DiscordMessageEmbedImage
from sentry.integrations.metric_alerts import (
    AlertContext,
    get_metric_count_from_incident,
    incident_attachment_info,
)


class DiscordMetricAlertMessageBuilder(DiscordMessageBuilder):
    def __init__(
        self,
        alert_rule: AlertRule,
        incident: Incident,
        new_status: IncidentStatus,
        metric_value: float | None = None,
        chart_url: str | None = None,
    ) -> None:
        self.alert_rule = alert_rule
        self.incident = incident
        self.metric_value = metric_value
        self.new_status = new_status
        self.chart_url = chart_url

    def build(self, notification_uuid: str | None = None) -> dict[str, object]:
        if self.metric_value is None:
            self.metric_value = get_metric_count_from_incident(self.incident)

        data = incident_attachment_info(
            AlertContext.from_alert_rule_incident(self.alert_rule),
            open_period_identifier=self.incident.identifier,
            organization=self.incident.organization,
            snuba_query=self.alert_rule.snuba_query,
            metric_value=self.metric_value,
            new_status=self.new_status,
            notification_uuid=notification_uuid,
            referrer="metric_alert_discord",
        )

        description = f"{data['text']}{get_started_at(self.incident.date_started)}"

        embeds = [
            DiscordMessageEmbed(
                title=data["title"],
                url=data["title_link"],
                description=description,
                color=LEVEL_TO_COLOR[INCIDENT_COLOR_MAPPING.get(data["status"], "")],
                image=DiscordMessageEmbedImage(url=self.chart_url) if self.chart_url else None,
            )
        ]

        return self._build(embeds=embeds)


def get_started_at(timestamp: datetime | None) -> str:
    if timestamp is None:
        return ""
    unix_timestamp = int(time.mktime(timestamp.timetuple()))
    return f"\nStarted <t:{unix_timestamp}:R>"
