from sentry.incidents.models.alert_rule import AlertRule
from sentry.incidents.models.incident import Incident, IncidentStatus
from sentry.integrations.metric_alerts import metric_alert_attachment_info
from sentry.integrations.slack.message_builder.base.block import BlockSlackMessageBuilder
from sentry.integrations.slack.message_builder.types import (
    INCIDENT_COLOR_MAPPING,
    LEVEL_TO_COLOR,
    SlackBody,
)
from sentry.integrations.slack.utils.escape import escape_slack_text


class SlackMetricAlertMessageBuilder(BlockSlackMessageBuilder):
    def __init__(
        self,
        alert_rule: AlertRule,
        incident: Incident | None = None,
        new_status: IncidentStatus | None = None,
        metric_value: int | None = None,
        chart_url: str | None = None,
    ) -> None:
        """
        Builds a metric alert attachment for slack unfurling.

        :param alert_rule: The `AlertRule` for which to build the attachment.
        :param incident: The `Incident` for which to build the attachment.
        :param [new_status]: The new status of a metric alert incident
        :param [metric_value]: The value of the metric that triggered this alert to
            fire. If not provided we'll attempt to calculate this ourselves.
        """
        super().__init__()
        self.alert_rule = alert_rule
        self.incident = incident
        self.metric_value = metric_value
        self.new_status = new_status
        self.chart_url = chart_url

    def build(self) -> SlackBody:
        data = metric_alert_attachment_info(
            self.alert_rule, self.incident, self.new_status, self.metric_value
        )

        blocks = [
            self.get_markdown_block(
                text=f"<{data['title_link']}|*{escape_slack_text(data['title'])}*>  \n{data['text']}"
            )
        ]

        if self.chart_url:
            blocks.append(self.get_image_block(self.chart_url, alt="Metric Alert Chart"))

        color = LEVEL_TO_COLOR.get(INCIDENT_COLOR_MAPPING.get(data["status"], ""))
        return self._build_blocks(
            *blocks,
            color=color,
        )
