from datetime import datetime
from typing import Optional

from sentry.incidents.models import Incident, IncidentStatus
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
        incident: Incident,
        new_status: IncidentStatus,
        metric_value: Optional[int] = None,
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

    def build(self) -> SlackBody:
        data = incident_attachment_info(self.incident, self.new_status, self.metric_value)

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
    incident: Incident,
    metric_value: Optional[int] = None,
) -> SlackBody:
    """@deprecated"""
    return SlackIncidentsMessageBuilder(
        incident, IncidentStatus(incident.status), metric_value
    ).build()
