from __future__ import absolute_import

from datetime import timedelta
from django.core.urlresolvers import reverse

from sentry.incidents.logic import get_incident_aggregates
from sentry.incidents.models import IncidentStatus, IncidentTrigger, INCIDENT_STATUS
from sentry.utils.assets import get_asset_url
from sentry.utils.http import absolute_uri

QUERY_AGGREGATION_DISPLAY = {
    "count()": "events",
    "count_unique(tags[sentry:user])": "users affected",
}


def incident_attachment_info(incident, metric_value=None):
    logo_url = absolute_uri(get_asset_url("sentry", "images/sentry-email-avatar.png"))
    alert_rule = incident.alert_rule

    incident_trigger = (
        IncidentTrigger.objects.filter(incident=incident).order_by("-date_modified").first()
    )
    if incident_trigger:
        alert_rule_trigger = incident_trigger.alert_rule_trigger
        # TODO: If we're relying on this and expecting possible delays between a
        # trigger fired and this function running, then this could actually be
        # incorrect if they changed the trigger's time window in this time period.
        # Should we store it?
        start = incident_trigger.date_modified - timedelta(
            seconds=alert_rule_trigger.alert_rule.snuba_query.time_window
        )
        end = incident_trigger.date_modified
    else:
        start, end = None, None

    status = INCIDENT_STATUS[IncidentStatus(incident.status)]

    agg_text = QUERY_AGGREGATION_DISPLAY.get(
        alert_rule.snuba_query.aggregate, alert_rule.snuba_query.aggregate
    )
    if metric_value is None:
        metric_value = get_incident_aggregates(incident, start, end, use_alert_aggregate=True)[
            "count"
        ]
    time_window = alert_rule.snuba_query.time_window // 60

    text = "{} {} in the last {} minutes".format(metric_value, agg_text, time_window)
    if alert_rule.snuba_query.query != "":
        text += "\nFilter: {}".format(alert_rule.snuba_query.query)

    ts = incident.date_started

    title = u"{}: {}".format(status, alert_rule.name)

    title_link = absolute_uri(
        reverse(
            "sentry-metric-alert",
            kwargs={
                "organization_slug": incident.organization.slug,
                "incident_id": incident.identifier,
            },
        )
    )

    return {
        "title": title,
        "text": text,
        "logo_url": logo_url,
        "status": status,
        "ts": ts,
        "title_link": title_link,
    }
