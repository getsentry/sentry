from datetime import datetime
from typing import Optional

from sentry.incidents.models import AlertRuleTriggerAction, Incident
from sentry.integrations.metric_alerts import incident_attachment_info
from sentry.integrations.slack.message_builder import INCIDENT_COLOR_MAPPING, SlackBody
from sentry.integrations.slack.message_builder.base.base import SlackMessageBuilder
from sentry.utils.dates import to_timestamp


def get_footer(timestamp: datetime) -> str:
    return "<!date^{:.0f}^Sentry Incident - Started {} at {} | Sentry Incident>".format(
        to_timestamp(timestamp), "{date_pretty}", "{time}"
    )


class SlackIncidentsMessageBuilder(SlackMessageBuilder):
    def __init__(
        self,
        action: AlertRuleTriggerAction,
        incident: Incident,
        metric_value: Optional[str] = None,
        method: Optional[str] = None,
    ) -> None:
        """
        Builds an incident attachment for slack unfurling.

        :param incident: The `Incident` to build the attachment for
        :param metric_value: The value of the metric that triggered this alert to
            fire. If not provided we'll attempt to calculate this ourselves.
        """
        super().__init__()
        self.action = action
        self.incident = incident
        self.metric_value = metric_value
        self.method = method

    def build(self) -> SlackBody:
        data = incident_attachment_info(
            self.incident, self.metric_value, action=self.action, method=self.method
        )

        return self._build(
            actions=[],
            color=INCIDENT_COLOR_MAPPING.get(data["status"]),
            fallback=data["title"],
            fields=[],
            footer=get_footer(data["ts"]),
            text=data["text"],
            title=data["title"],
            title_link=data["title_link"],
        )


def build_incident_attachment(
    action: AlertRuleTriggerAction,
    incident: Incident,
    metric_value: Optional[str] = None,
    method: Optional[str] = None,
) -> SlackBody:
    """@deprecated"""
    return SlackIncidentsMessageBuilder(action, incident, metric_value, method).build()
