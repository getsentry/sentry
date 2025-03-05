from datetime import datetime

from sentry.incidents.models.incident import Incident, IncidentStatus
from sentry.integrations.metric_alerts import (
    AlertContext,
    OpenPeriodParams,
    get_metric_count_from_incident,
    incident_attachment_info,
)
from sentry.integrations.slack.message_builder.base.block import BlockSlackMessageBuilder
from sentry.integrations.slack.message_builder.types import (
    INCIDENT_COLOR_MAPPING,
    LEVEL_TO_COLOR,
    SlackBody,
)
from sentry.integrations.slack.utils.escape import escape_slack_text


def get_started_at(timestamp: datetime | None) -> str:
    if timestamp is None:
        return ""
    return "<!date^{:.0f}^Started: {} at {} | Sentry Incident>".format(
        timestamp.timestamp(), "{date_pretty}", "{time}"
    )


class SlackIncidentsMessageBuilder(BlockSlackMessageBuilder):
    def __init__(
        self,
        incident: Incident,
        new_status: IncidentStatus,
        metric_value: float | None = None,
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
        self.incident = incident
        self.metric_value = metric_value
        self.new_status = new_status
        self.chart_url = chart_url
        self.notification_uuid = notification_uuid

    def build(self) -> SlackBody:
        # (iamrajjoshi): Need this check since the type hint is wrong.
        if self.metric_value is None:
            self.metric_value = get_metric_count_from_incident(self.incident)

        data = incident_attachment_info(
            AlertContext.from_alert_rule_incident(self.incident.alert_rule),
            OpenPeriodParams.from_incident(self.incident),
            organization=self.incident.organization,
            snuba_query=self.incident.alert_rule.snuba_query,
            metric_value=self.metric_value,
            notification_uuid=self.notification_uuid,
            referrer="metric_alert_slack",
        )

        incident_text = f"{data['text']}\n{get_started_at(self.incident.date_started)}"
        blocks = [
            self.get_markdown_block(text=incident_text),
        ]

        if self.chart_url:
            blocks.append(self.get_image_block(self.chart_url, alt="Metric Alert Chart"))

        color = LEVEL_TO_COLOR.get(INCIDENT_COLOR_MAPPING.get(data["status"], ""))
        fallback_text = f"<{data['title_link']}|*{escape_slack_text(data['title'])}*>"
        return self._build_blocks(*blocks, fallback_text=fallback_text, color=color)
