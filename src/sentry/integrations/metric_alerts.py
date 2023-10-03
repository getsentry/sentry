from datetime import timedelta
from typing import Optional
from urllib import parse

from django.db.models import Max
from django.urls import reverse
from django.utils.translation import gettext as _

from sentry.constants import CRASH_RATE_ALERT_AGGREGATE_ALIAS
from sentry.incidents.logic import get_incident_aggregates
from sentry.incidents.models import (
    INCIDENT_STATUS,
    AlertRule,
    AlertRuleThresholdType,
    Incident,
    IncidentStatus,
    IncidentTrigger,
)
from sentry.utils.assets import get_asset_url
from sentry.utils.http import absolute_uri

QUERY_AGGREGATION_DISPLAY = {
    "count()": "events",
    "count_unique(tags[sentry:user])": "users affected",
    "percentage(sessions_crashed, sessions)": "% sessions crash free rate",
    "percentage(users_crashed, users)": "% users crash free rate",
}
LOGO_URL = absolute_uri(get_asset_url("sentry", "images/sentry-email-avatar.png"))
# These should be the same as the options in the frontend
# COMPARISON_DELTA_OPTIONS
TEXT_COMPARISON_DELTA = {
    5: ("same time 5 minutes ago"),  # 5 minutes
    15: ("same time 15 minutes ago"),  # 15 minutes
    60: ("same time one hour ago"),  # one hour
    1440: ("same time one day ago"),  # one day
    10080: ("same time one week ago"),  # one week
    43200: ("same time one month ago"),  # 30 days
}


def get_metric_count_from_incident(incident: Incident) -> str:
    """Returns the current or last count of an incident aggregate."""
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

    return get_incident_aggregates(incident=incident, start=start, end=end).get("count")


def get_incident_status_text(alert_rule: AlertRule, metric_value: str) -> str:
    """Returns a human readable current status of an incident"""
    agg_display_key = alert_rule.snuba_query.aggregate

    if CRASH_RATE_ALERT_AGGREGATE_ALIAS in alert_rule.snuba_query.aggregate:
        agg_display_key = agg_display_key.split(f"AS {CRASH_RATE_ALERT_AGGREGATE_ALIAS}")[0].strip()

    agg_text = QUERY_AGGREGATION_DISPLAY.get(agg_display_key, alert_rule.snuba_query.aggregate)

    if agg_text.startswith("%"):
        if metric_value is not None:
            metric_and_agg_text = f"{metric_value}{agg_text}"
        else:
            metric_and_agg_text = f"No{agg_text[1:]}"
    else:
        metric_and_agg_text = f"{metric_value} {agg_text}"

    time_window = alert_rule.snuba_query.time_window // 60
    interval = "minute" if time_window == 1 else "minutes"
    # % change alerts have a comparison delta
    if alert_rule.comparison_delta:
        metric_and_agg_text = f"{agg_text.capitalize()} {int(metric_value)}%"
        higher_or_lower = (
            "higher" if alert_rule.threshold_type == AlertRuleThresholdType.ABOVE.value else "lower"
        )
        comparison_delta_minutes = alert_rule.comparison_delta // 60
        comparison_string = TEXT_COMPARISON_DELTA.get(
            comparison_delta_minutes, f"same time {comparison_delta_minutes} minutes ago"
        )
        return _(
            f"{metric_and_agg_text} {higher_or_lower} in the last {time_window} {interval} "
            f"compared to the {comparison_string}"
        )

    return _("%(metric_and_agg_text)s in the last %(time_window)d %(interval)s") % {
        "metric_and_agg_text": metric_and_agg_text,
        "time_window": time_window,
        "interval": interval,
    }


def incident_attachment_info(
    incident: Incident,
    new_status: IncidentStatus,
    metric_value=None,
    notification_uuid=None,
    referrer="metric_alert",
):
    alert_rule = incident.alert_rule

    status = INCIDENT_STATUS[new_status]

    if metric_value is None:
        metric_value = get_metric_count_from_incident(incident)

    text = get_incident_status_text(alert_rule, metric_value)
    title = f"{status}: {alert_rule.name}"

    title_link_params = {
        "alert": str(incident.identifier),
        "referrer": referrer,
    }
    if notification_uuid:
        title_link_params["notification_uuid"] = notification_uuid

    title_link = alert_rule.organization.absolute_url(
        reverse(
            "sentry-metric-alert-details",
            kwargs={
                "organization_slug": alert_rule.organization.slug,
                "alert_rule_id": alert_rule.id,
            },
        ),
        query=parse.urlencode(title_link_params),
    )

    return {
        "title": title,
        "text": text,
        "logo_url": LOGO_URL,
        "status": status,
        "ts": incident.date_started,
        "title_link": title_link,
    }


def metric_alert_attachment_info(
    alert_rule: AlertRule,
    selected_incident: Optional[Incident] = None,
    new_status: Optional[IncidentStatus] = None,
    metric_value: Optional[int] = None,
):
    latest_incident = None
    if selected_incident is None:
        try:
            # Use .get() instead of .first() to avoid sorting table by id
            latest_incident = Incident.objects.filter(
                id__in=Incident.objects.filter(alert_rule=alert_rule)
                .values("alert_rule_id")
                .annotate(incident_id=Max("id"))
                .values("incident_id")
            ).get()
        except Incident.DoesNotExist:
            latest_incident = None

    if new_status:
        status = INCIDENT_STATUS[new_status]
    elif selected_incident:
        status = INCIDENT_STATUS[IncidentStatus(selected_incident.status)]
    elif latest_incident:
        status = INCIDENT_STATUS[IncidentStatus(latest_incident.status)]
    else:
        status = INCIDENT_STATUS[IncidentStatus.CLOSED]

    query = None
    if selected_incident:
        query = parse.urlencode({"alert": str(selected_incident.identifier)})
    title = f"{status}: {alert_rule.name}"
    title_link = alert_rule.organization.absolute_url(
        reverse(
            "sentry-metric-alert-details",
            kwargs={
                "organization_slug": alert_rule.organization.slug,
                "alert_rule_id": alert_rule.id,
            },
        ),
        query=query,
    )

    if metric_value is None:
        if (
            selected_incident is None
            and latest_incident
            and latest_incident.status != IncidentStatus.CLOSED
        ):
            # Without a selected incident, use latest incident if it is not resolved
            incident_info = latest_incident
        else:
            incident_info = selected_incident

        if incident_info:
            metric_value = get_metric_count_from_incident(incident_info)

    text = ""
    if metric_value is not None and status != INCIDENT_STATUS[IncidentStatus.CLOSED]:
        text = get_incident_status_text(alert_rule, metric_value)

    date_started = None
    if selected_incident:
        date_started = selected_incident.date_started

    last_triggered_date = None
    if latest_incident:
        last_triggered_date = latest_incident.date_started

    return {
        "title": title,
        "text": text,
        "logo_url": LOGO_URL,
        "status": status,
        "date_started": date_started,
        "last_triggered_date": last_triggered_date,
        "title_link": title_link,
    }
