from typing import int
from datetime import datetime

from sentry.incidents.typings.metric_detector import AlertContext, MetricIssueContext
from sentry.integrations.messaging.types import LEVEL_TO_COLOR
from sentry.integrations.metric_alerts import incident_attachment_info
from sentry.integrations.slack.message_builder.base.block import BlockSlackMessageBuilder
from sentry.integrations.slack.message_builder.types import INCIDENT_COLOR_MAPPING, SlackBody
from sentry.integrations.slack.utils.escape import escape_slack_text
from sentry.models.organization import Organization


def get_started_at(timestamp: datetime | None) -> str:
    if timestamp is None:
        return ""
    return "<!date^{:.0f}^Started: {} at {} | Sentry Incident>".format(
        timestamp.timestamp(), "{date_pretty}", "{time}"
    )


class SlackIncidentsMessageBuilder(BlockSlackMessageBuilder):
    def __init__(
        self,
        alert_context: AlertContext,
        metric_issue_context: MetricIssueContext,
        organization: Organization,
        date_started: datetime,
        chart_url: str | None = None,
        notification_uuid: str | None = None,
    ) -> None:
        """
        Builds an incident attachment when a metric alert fires or is resolved.

        :param incident: The `Incident` for which to build the attachment.
        :param [metric_value]: The value of the metric that triggered this alert to
            fire. If not provided we'll attempt to calculate this ourselves.
        :param [method]: Either "fire" or "resolve".
        """
        super().__init__()
        self.alert_context = alert_context
        self.metric_issue_context = metric_issue_context
        self.organization = organization
        self.date_started = date_started
        self.chart_url = chart_url
        self.notification_uuid = notification_uuid

    def build(self) -> SlackBody:
        data = incident_attachment_info(
            alert_context=self.alert_context,
            metric_issue_context=self.metric_issue_context,
            organization=self.organization,
            notification_uuid=self.notification_uuid,
            referrer="metric_alert_slack",
        )

        incident_text = f"{data['text']}\n{get_started_at(self.date_started)}"
        blocks = [
            self.get_markdown_block(text=incident_text),
        ]

        if self.chart_url:
            blocks.append(self.get_image_block(self.chart_url, alt="Metric Alert Chart"))

        color = LEVEL_TO_COLOR.get(INCIDENT_COLOR_MAPPING.get(data["status"], ""))
        fallback_text = f"<{data['title_link']}|*{escape_slack_text(data['title'])}*>"
        return self._build_blocks(*blocks, fallback_text=fallback_text, color=color)
