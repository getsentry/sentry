from sentry.integrations.metric_alerts import incident_attachment_info
from sentry.integrations.slack.utils import INCIDENT_RESOLVED_COLOR, LEVEL_TO_COLOR
from sentry.utils.dates import to_timestamp


def build_incident_attachment(action, incident, metric_value=None, method=None):
    """
    Builds an incident attachment for slack unfurling

    :param incident: The `Incident` to build the attachment for
    :param metric_value: The value of the metric that triggered this alert to
    fire. If not provided we'll attempt to calculate this ourselves.
    """

    data = incident_attachment_info(incident, metric_value, action=action, method=method)

    colors = {
        "Resolved": INCIDENT_RESOLVED_COLOR,
        "Warning": LEVEL_TO_COLOR["warning"],
        "Critical": LEVEL_TO_COLOR["fatal"],
    }

    incident_footer_ts = (
        "<!date^{:.0f}^Sentry Incident - Started {} at {} | Sentry Incident>".format(
            to_timestamp(data["ts"]), "{date_pretty}", "{time}"
        )
    )

    return {
        "fallback": data["title"],
        "title": data["title"],
        "title_link": data["title_link"],
        "text": data["text"],
        "fields": [],
        "mrkdwn_in": ["text"],
        "footer_icon": data["logo_url"],
        "footer": incident_footer_ts,
        "color": colors[data["status"]],
        "actions": [],
    }
