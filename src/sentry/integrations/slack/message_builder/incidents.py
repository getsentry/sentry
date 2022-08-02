from datetime import datetime
from typing import Optional

from sentry.incidents.models import Incident, IncidentStatus
from sentry.integrations.metric_alerts import incident_attachment_info
from sentry.integrations.slack.message_builder import (
    INCIDENT_COLOR_MAPPING,
    LEVEL_TO_COLOR,
    SlackBody,
)
from sentry.integrations.slack.message_builder.base.block import BlockSlackMessageBuilder
from sentry.integrations.slack.utils.escape import escape_slack_text
from sentry.utils.dates import to_timestamp


def get_started_at(timestamp: datetime) -> str:
    return "<!date^{:.0f}^Started {} at {} | Sentry Incident>".format(
        to_timestamp(timestamp), "{date_pretty}", "{time}"
    )


class SlackIncidentsMessageBuilder(BlockSlackMessageBuilder):
    def __init__(
        self,
        incident: Incident,
        new_status: IncidentStatus,
        metric_value: Optional[int] = None,
        chart_url: Optional[str] = None,
    ) -> None:
        """
        Builds an incident attachment for slack unfurling.

        :param incident: The `Incident` for which to build the attachment.
        :param [metric_value]: The value of the metric that triggered this alert to
            fire. If not provided we'll attempt to calculate this ourselves.
        :param [method]: Either "fire" or "resolve".
        """
        super().__init__()
        self.incident = incident
        self.metric_value = metric_value
        self.new_status = new_status
        self.chart_url = chart_url

    def build(self) -> SlackBody:
        data = incident_attachment_info(self.incident, self.new_status, self.metric_value)

        blocks = [
            self.get_markdown_block(text=f"{data['text']}\n{get_started_at(data['ts'])}"),
        ]

        if self.chart_url:
            blocks.append(self.get_image_block(self.chart_url, alt="Metric Alert Chart"))

        color = LEVEL_TO_COLOR.get(INCIDENT_COLOR_MAPPING.get(data["status"], ""))
        fallback_text = (
            f"<{data['title_link']}&referrer=slack|*{escape_slack_text(data['title'])}*>"
        )
        return self._build_blocks(*blocks, fallback_text=fallback_text, color=color)
