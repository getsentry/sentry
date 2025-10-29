from sentry.incidents.models.incident import IncidentStatus
from sentry.integrations.messaging.types import LEVEL_TO_COLOR
from sentry.integrations.slack.message_builder.base.block import BlockSlackMessageBuilder
from sentry.integrations.slack.message_builder.types import INCIDENT_COLOR_MAPPING, SlackBody
from sentry.integrations.slack.utils.escape import escape_slack_text
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.workflow_engine.models.detector import Detector


class SlackMetricDetectorMessageBuilder(BlockSlackMessageBuilder):
    def __init__(
        self,
        detector: Detector,
        open_period: GroupOpenPeriod | None = None,
        new_status: IncidentStatus | None = None,
        metric_value: int | None = None,
        chart_url: str | None = None,
    ) -> None:
        """
        Builds a metric alert attachment for slack unfurling.

        :param detector: The `Detector` for which to build the attachment.
        :param open_period: The `Open Period` for which to build the attachment.
        :param [new_status]: The new status of a metric issue open period
        :param [metric_value]: The value of the metric that triggered this alert to
            fire. If not provided we'll attempt to calculate this ourselves.
        """
        super().__init__()
        self.detector = detector
        self.open_period = open_period
        self.metric_value = metric_value
        self.new_status = new_status
        self.chart_url = chart_url

    def build(self) -> SlackBody:
        data = {"title_link": "hello world", "title": "testing stuff", "text": ":D"}

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
