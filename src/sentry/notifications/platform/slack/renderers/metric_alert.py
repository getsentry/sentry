from __future__ import annotations

from sentry.incidents.models.incident import IncidentStatus
from sentry.integrations.messaging.types import LEVEL_TO_COLOR
from sentry.integrations.metric_alerts import get_status_text
from sentry.integrations.slack.message_builder.base.block import BlockSlackMessageBuilder
from sentry.integrations.slack.message_builder.incidents import get_started_at
from sentry.integrations.slack.message_builder.types import INCIDENT_COLOR_MAPPING
from sentry.integrations.slack.utils.escape import escape_slack_text
from sentry.notifications.platform.renderer import NotificationRenderer
from sentry.notifications.platform.slack.provider import SlackRenderable
from sentry.notifications.platform.templates.metric_alert import MetricAlertNotificationData
from sentry.notifications.platform.types import (
    NotificationData,
    NotificationProviderKey,
    NotificationRenderedTemplate,
)


class SlackMetricAlertRenderer(NotificationRenderer[SlackRenderable]):
    provider_key = NotificationProviderKey.SLACK

    @classmethod
    def render[DataT: NotificationData](
        cls, *, data: DataT, rendered_template: NotificationRenderedTemplate
    ) -> SlackRenderable:
        if not isinstance(data, MetricAlertNotificationData):
            raise ValueError(f"SlackMetricAlertRenderer does not support {data.__class__.__name__}")

        status = get_status_text(IncidentStatus(data.new_status))

        incident_text = f"{data.text}\n{get_started_at(data.open_period_context.date_started)}"
        blocks = [BlockSlackMessageBuilder.get_markdown_block(text=incident_text)]

        if data.chart_url:
            blocks.append(
                BlockSlackMessageBuilder.get_image_block(data.chart_url, alt="Metric Alert Chart")
            )

        color = LEVEL_TO_COLOR.get(INCIDENT_COLOR_MAPPING.get(status, ""))
        fallback_text = f"<{data.title_link}|*{escape_slack_text(data.title)}*>"
        slack_body = BlockSlackMessageBuilder._build_blocks(
            *blocks, fallback_text=fallback_text, color=color
        )

        attachment_blocks = [{"blocks": slack_body.get("blocks", [])}]

        if color:
            attachment_blocks[0]["color"] = color

        renderable = SlackRenderable(
            blocks=[],
            attachments=attachment_blocks,
            text=slack_body.get("text", ""),
        )

        return renderable
