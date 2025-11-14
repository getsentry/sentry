from __future__ import annotations
from typing import int

import time
from datetime import datetime

from sentry.incidents.typings.metric_detector import AlertContext, MetricIssueContext
from sentry.integrations.discord.message_builder import INCIDENT_COLOR_MAPPING, LEVEL_TO_COLOR
from sentry.integrations.discord.message_builder.base.base import (
    DiscordMessage,
    DiscordMessageBuilder,
)
from sentry.integrations.discord.message_builder.base.embed.base import DiscordMessageEmbed
from sentry.integrations.discord.message_builder.base.embed.image import DiscordMessageEmbedImage
from sentry.integrations.metric_alerts import incident_attachment_info
from sentry.models.organization import Organization


class DiscordMetricAlertMessageBuilder(DiscordMessageBuilder):
    def __init__(
        self,
        alert_context: AlertContext,
        metric_issue_context: MetricIssueContext,
        organization: Organization,
        date_started: datetime,
        chart_url: str | None = None,
    ) -> None:
        self.alert_context = alert_context
        self.metric_issue_context = metric_issue_context
        self.organization = organization
        self.date_started = date_started
        self.chart_url = chart_url

    def build(self, notification_uuid: str | None = None) -> DiscordMessage:
        data = incident_attachment_info(
            organization=self.organization,
            alert_context=self.alert_context,
            metric_issue_context=self.metric_issue_context,
            notification_uuid=notification_uuid,
            referrer="metric_alert_discord",
        )

        description = f"{data['text']}{get_started_at(self.date_started)}"

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
