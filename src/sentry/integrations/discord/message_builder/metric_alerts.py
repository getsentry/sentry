from __future__ import annotations

import time
from datetime import datetime

from sentry.incidents.models.alert_rule import AlertRule
from sentry.incidents.models.incident import Incident, IncidentStatus
from sentry.integrations.discord.message_builder import INCIDENT_COLOR_MAPPING, LEVEL_TO_COLOR
from sentry.integrations.discord.message_builder.base.base import DiscordMessageBuilder
from sentry.integrations.discord.message_builder.base.embed.base import DiscordMessageEmbed
from sentry.integrations.discord.message_builder.base.embed.image import DiscordMessageEmbedImage
from sentry.integrations.metric_alerts import incident_attachment_info


class DiscordMetricAlertMessageBuilder(DiscordMessageBuilder):
    def __init__(
        self,
        alert_rule: AlertRule,
        incident: Incident,
        new_status: IncidentStatus,
        metric_value: float,
        chart_url: str | None = None,
    ) -> None:
        self.alert_rule = alert_rule
        self.incident = incident
        self.metric_value = metric_value
        self.new_status = new_status
        self.chart_url = chart_url

    def build(self, notification_uuid: str | None = None) -> dict[str, object]:
        data = incident_attachment_info(
            self.incident,
            self.new_status,
            self.metric_value,
            notification_uuid,
            referrer="metric_alert_discord",
        )

        description = f"{data['text']}{get_started_at(data['date_started'])}"

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
