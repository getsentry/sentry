from datetime import timedelta

from django.urls import reverse
from django.utils.translation import ugettext as _

from sentry.constants import CRASH_RATE_ALERT_AGGREGATE_ALIAS
from sentry.incidents.logic import get_incident_aggregates
from sentry.incidents.models import INCIDENT_STATUS, IncidentStatus, IncidentTrigger
from sentry.utils.assets import get_asset_url
from sentry.utils.http import absolute_uri

QUERY_AGGREGATION_DISPLAY = {
    "count()": "events",
    "count_unique(tags[sentry:user])": "users affected",
    "percentage(sessions_crashed, sessions)": "% sessions crash free rate",
    "percentage(users_crashed, users)": "% users crash free rate",
}


def incident_attachment_info(incident, new_status: IncidentStatus, metric_value=None):
    logo_url = absolute_uri(get_asset_url("sentry", "images/sentry-email-avatar.png"))
    alert_rule = incident.alert_rule

    status = INCIDENT_STATUS[new_status]

    agg_display_key = alert_rule.snuba_query.aggregate

    if CRASH_RATE_ALERT_AGGREGATE_ALIAS in alert_rule.snuba_query.aggregate:
        agg_display_key = agg_display_key.split(f"AS {CRASH_RATE_ALERT_AGGREGATE_ALIAS}")[0].strip()

    agg_text = QUERY_AGGREGATION_DISPLAY.get(agg_display_key, alert_rule.snuba_query.aggregate)

    if metric_value is None:
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

        metric_value = get_incident_aggregates(incident=incident, start=start, end=end).get("count")
    time_window = alert_rule.snuba_query.time_window // 60

    if agg_text.startswith("%"):
        if metric_value is not None:
            metric_and_agg_text = f"{metric_value}{agg_text}"
        else:
            metric_and_agg_text = f"No{agg_text[1:]}"
    else:
        metric_and_agg_text = f"{metric_value} {agg_text}"

    interval = "minute" if time_window == 1 else "minutes"
    text = _("%(metric_and_agg_text)s in the last %(time_window)d %(interval)s") % {
        "metric_and_agg_text": metric_and_agg_text,
        "time_window": time_window,
        "interval": interval,
    }
    if alert_rule.snuba_query.query != "":
        text += f"\nFilter: {alert_rule.snuba_query.query}"

    ts = incident.date_started

    title = f"{status}: {alert_rule.name}"

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
