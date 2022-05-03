from datetime import datetime
from typing import Optional

from sentry.incidents.models import AlertRule, Incident, IncidentStatus
from sentry.integrations.metric_alerts import metric_alert_attachment_info
from sentry.integrations.slack.message_builder import INCIDENT_COLOR_MAPPING, SlackBody
from sentry.integrations.slack.message_builder.base.base import SlackMessageBuilder
from sentry.utils.dates import to_timestamp


def get_footer(
    incident_triggered_date: Optional[datetime], last_triggered_date: Optional[datetime]
) -> str:
    if incident_triggered_date:
        return "<!date^{:.0f}^Sentry Incident - Started {} at {} | Sentry Incident>".format(
            to_timestamp(incident_triggered_date), "{date_pretty}", "{time}"
        )

    if last_triggered_date:
        return "<!date^{:.0f}^Metric Alert - Last Triggered {} at {} | Metric Alert>".format(
            to_timestamp(last_triggered_date), "{date_pretty}", "{time}"
        )

    return "Metric Alert"


class SlackMetricAlertMessageBuilder(SlackMessageBuilder):
    def __init__(
        self,
        alert_rule: AlertRule,
        incident: Optional[Incident] = None,
        new_status: Optional[IncidentStatus] = None,
        metric_value: Optional[int] = None,
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

    def build(self) -> SlackBody:
        data = metric_alert_attachment_info(
            self.alert_rule, self.incident, self.new_status, self.metric_value
        )

        return self._build(
            actions=[],
            color=INCIDENT_COLOR_MAPPING.get(data["status"]),
            fallback=data["title"],
            fields=[],
            footer=get_footer(data["date_started"], data["last_triggered_date"]),
            text=data["text"],
            title=data["title"],
            title_link=data["title_link"],
        )
