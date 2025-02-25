from datetime import datetime, timedelta
from typing import TypedDict
from urllib import parse

import sentry_sdk
from django.db.models import Max
from django.urls import reverse
from django.utils.translation import gettext as _

from sentry import features
from sentry.constants import CRASH_RATE_ALERT_AGGREGATE_ALIAS
from sentry.incidents.logic import get_incident_aggregates
from sentry.incidents.models.alert_rule import AlertRule, AlertRuleThresholdType
from sentry.incidents.models.incident import (
    INCIDENT_STATUS,
    Incident,
    IncidentStatus,
    IncidentTrigger,
)
from sentry.incidents.utils.format_duration import format_duration_idiomatic
from sentry.models.organization import Organization
from sentry.snuba.metrics import format_mri_field, format_mri_field_value, is_mri_field
from sentry.snuba.models import SnubaQuery
from sentry.utils.assets import get_asset_url
from sentry.utils.http import absolute_uri

QUERY_AGGREGATION_DISPLAY = {
    "count()": "events",
    "count_unique(tags[sentry:user])": "users affected",
    "percentage(sessions_crashed, sessions)": "% sessions crash free rate",
    "percentage(users_crashed, users)": "% users crash free rate",
}
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


class AttachmentInfo(TypedDict):
    title_link: str
    title: str
    text: str
    status: str
    logo_url: str
    date_started: datetime | None


class TitleLinkParams(TypedDict, total=False):
    alert: str
    referrer: str
    detection_type: str
    notification_uuid: str


def logo_url() -> str:
    return absolute_uri(get_asset_url("sentry", "images/sentry-email-avatar.png"))


def get_metric_count_from_incident(incident: Incident) -> float | None:
    """Returns the current or last count of an incident aggregate."""
    # TODO(iamrajjoshi): Hoist FK lookup up
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


def get_incident_status_text(
    snuba_query: SnubaQuery,
    threshold_type: int | None,
    comparison_delta: int | None,
    metric_value: str,
) -> str:
    """Returns a human readable current status of an incident"""
    agg_display_key = snuba_query.aggregate

    if CRASH_RATE_ALERT_AGGREGATE_ALIAS in snuba_query.aggregate:
        agg_display_key = agg_display_key.split(f"AS {CRASH_RATE_ALERT_AGGREGATE_ALIAS}")[0].strip()

    if is_mri_field(agg_display_key):
        metric_value = format_mri_field_value(agg_display_key, metric_value)
        agg_text = format_mri_field(agg_display_key)
    else:
        agg_text = QUERY_AGGREGATION_DISPLAY.get(agg_display_key, snuba_query.aggregate)

    if agg_text.startswith("%"):
        if metric_value is not None:
            metric_and_agg_text = f"{metric_value}{agg_text}"
        else:
            metric_and_agg_text = f"No{agg_text[1:]}"
    else:
        metric_and_agg_text = f"{metric_value} {agg_text}"

    time_window = snuba_query.time_window // 60
    # % change alerts have a comparison delta
    if comparison_delta:
        metric_and_agg_text = f"{agg_text.capitalize()} {int(float(metric_value))}%"
        higher_or_lower = (
            "higher" if threshold_type == AlertRuleThresholdType.ABOVE.value else "lower"
        )
        comparison_delta_minutes = comparison_delta // 60
        comparison_string = TEXT_COMPARISON_DELTA.get(
            comparison_delta_minutes, f"same time {comparison_delta_minutes} minutes ago"
        )
        return _(
            f"{metric_and_agg_text} {higher_or_lower} in the last {format_duration_idiomatic(time_window)} "
            f"compared to the {comparison_string}"
        )

    return _(f"{metric_and_agg_text} in the last {format_duration_idiomatic(time_window)}")


def get_status_text(status: IncidentStatus) -> str:
    return INCIDENT_STATUS[status]


def get_title(status: str, name: str) -> str:
    return f"{status}: {name}"


def build_title_link(
    identifier_id: str, organization: Organization, params: TitleLinkParams
) -> str:
    """Builds the URL for an alert rule with the given parameters."""
    return organization.absolute_url(
        reverse(
            "sentry-metric-alert-details",
            kwargs={
                "organization_slug": organization.slug,
                "alert_rule_id": identifier_id,
            },
        ),
        query=parse.urlencode(params),
    )


def incident_attachment_info(
    incident: Incident,
    new_status: IncidentStatus,
    # WIP(iamrajjoshi): This should shouldn't be None, but it sometimes is. Working on figuring out why.
    metric_value: float | None = None,
    notification_uuid=None,
    referrer="metric_alert",
) -> AttachmentInfo:
    alert_rule = incident.alert_rule

    if metric_value is None:
        sentry_sdk.capture_message(
            "Metric value is None when building incident attachment info",
            level="warning",
        )
        # TODO(iamrajjoshi): This should be fixed by the time we get rid of this function.
        metric_value = get_metric_count_from_incident(incident)

    status = get_status_text(new_status)

    text = get_incident_status_text(
        alert_rule.snuba_query,
        alert_rule.threshold_type,
        alert_rule.comparison_delta,
        str(metric_value),
    )
    if features.has(
        "organizations:anomaly-detection-alerts", incident.organization
    ) and features.has("organizations:anomaly-detection-rollout", incident.organization):
        text += f"\nThreshold: {alert_rule.detection_type.title()}"

    title = get_title(status, alert_rule.name)

    title_link_params: TitleLinkParams = {
        "alert": str(incident.identifier),
        "referrer": referrer,
        "detection_type": alert_rule.detection_type,
    }
    if notification_uuid:
        title_link_params["notification_uuid"] = notification_uuid

    title_link = build_title_link(alert_rule.id, alert_rule.organization, title_link_params)

    return AttachmentInfo(
        title=title,
        text=text,
        logo_url=logo_url(),
        status=status,
        date_started=incident.date_started,
        title_link=title_link,
    )


def metric_alert_unfurl_attachment_info(
    alert_rule: AlertRule,
    selected_incident: Incident | None = None,
    new_status: IncidentStatus | None = None,
    metric_value: float | None = None,
) -> AttachmentInfo:
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
        status = get_status_text(new_status)
    elif selected_incident:
        status = get_status_text(IncidentStatus(selected_incident.status))
    elif latest_incident:
        status = get_status_text(IncidentStatus(latest_incident.status))
    else:
        status = get_status_text(IncidentStatus.CLOSED)

    title_link_params: TitleLinkParams = {"detection_type": alert_rule.detection_type}
    if selected_incident:
        title_link_params["alert"] = str(selected_incident.identifier)

    title = get_title(status, alert_rule.name)
    title_link = build_title_link(alert_rule.id, alert_rule.organization, title_link_params)

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
            # TODO(iamrajjoshi): Hoist FK lookup up
            metric_value = get_metric_count_from_incident(incident_info)

    text = ""
    if metric_value is not None and status != INCIDENT_STATUS[IncidentStatus.CLOSED]:
        text = get_incident_status_text(
            alert_rule.snuba_query,
            alert_rule.threshold_type,
            alert_rule.comparison_delta,
            str(metric_value),
        )

    if features.has(
        "organizations:anomaly-detection-alerts", alert_rule.organization
    ) and features.has("organizations:anomaly-detection-rollout", alert_rule.organization):
        text += f"\nThreshold: {alert_rule.detection_type.title()}"

    date_started = None
    if selected_incident:
        date_started = selected_incident.date_started

    return AttachmentInfo(
        title_link=title_link,
        title=title,
        text=text,
        status=status,
        logo_url=logo_url(),
        date_started=date_started,
    )
