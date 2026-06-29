from __future__ import annotations

from sentry.incidents.models.incident import IncidentStatus
from sentry.integrations.discord.message_builder import INCIDENT_COLOR_MAPPING, LEVEL_TO_COLOR
from sentry.integrations.discord.message_builder.base.base import DiscordMessageBuilder
from sentry.integrations.discord.message_builder.base.embed.base import DiscordMessageEmbed
from sentry.integrations.discord.message_builder.base.embed.image import DiscordMessageEmbedImage
from sentry.integrations.discord.message_builder.metric_alerts import get_started_at
from sentry.integrations.metric_alerts import get_status_text
from sentry.notifications.platform.discord.provider import DiscordRenderable
from sentry.notifications.platform.renderer import NotificationRenderer
from sentry.notifications.platform.templates.metric_alert import MetricAlertNotificationData
from sentry.notifications.platform.types import (
    NotificationData,
    NotificationProviderKey,
    NotificationRenderedTemplate,
)


class DiscordMetricAlertRenderer(NotificationRenderer[DiscordRenderable]):
    provider_key = NotificationProviderKey.DISCORD

    @classmethod
    def render[DataT: NotificationData](
        cls, *, data: DataT, rendered_template: NotificationRenderedTemplate
    ) -> DiscordRenderable:
        if not isinstance(data, MetricAlertNotificationData):
            raise ValueError(
                f"DiscordMetricAlertRenderer does not support '{data.__class__.__name__}'. Provide a MetricAlertNotificationData instead."
            )

        status = get_status_text(IncidentStatus(data.new_status))
        description = f"{data.text}{get_started_at(data.open_period_context.date_started)}"
        color = LEVEL_TO_COLOR.get(INCIDENT_COLOR_MAPPING.get(status, ""))

        embed = DiscordMessageEmbed(
            title=data.title,
            url=data.title_link,
            description=description,
            color=color,
            image=(DiscordMessageEmbedImage(url=data.chart_url) if data.chart_url else None),
        )

        return DiscordMessageBuilder(embeds=[embed]).build()
