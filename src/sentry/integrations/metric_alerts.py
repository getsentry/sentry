from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import NotRequired, TypedDict
from urllib import parse

from django.db.models import Max
from django.urls import reverse
from django.utils.translation import gettext as _

from sentry import features
from sentry.constants import CRASH_RATE_ALERT_AGGREGATE_ALIAS
from sentry.incidents.logic import GetMetricIssueAggregatesParams, get_metric_issue_aggregates
from sentry.incidents.models.alert_rule import (
    AlertRule,
    AlertRuleDetectionType,
    AlertRuleThresholdType,
)
from sentry.incidents.models.incident import (
    INCIDENT_STATUS,
    Incident,
    IncidentProject,
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
    date_started: NotRequired[datetime | None]


class TitleLinkParams(TypedDict, total=False):
    alert: str
    referrer: str
    detection_type: str
    notification_uuid: str


@dataclass
class OpenPeriodParams:
    open_period_identifier_id: int
    new_status: IncidentStatus

    @classmethod
    def from_incident(cls, incident: Incident) -> OpenPeriodParams:
        return cls(
            open_period_identifier_id=incident.identifier,
            new_status=IncidentStatus(incident.status),
        )


@dataclass
class AlertContext:
    name: str
    action_identifier_id: int
    threshold_type: AlertRuleThresholdType | None
    detection_type: AlertRuleDetectionType
    comparison_delta: int | None

    @classmethod
    def from_alert_rule_incident(cls, alert_rule: AlertRule) -> AlertContext:
        return cls(
            name=alert_rule.name,
            action_identifier_id=alert_rule.id,
            threshold_type=AlertRuleThresholdType(alert_rule.threshold_type),
            detection_type=AlertRuleDetectionType(alert_rule.detection_type),
            comparison_delta=alert_rule.comparison_delta,
        )


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

    organization = Organization.objects.get_from_cache(id=incident.organization_id)

    project_ids = list(
        IncidentProject.objects.filter(incident=incident).values_list("project_id", flat=True)
    )

    params = GetMetricIssueAggregatesParams(
        snuba_query=incident.alert_rule.snuba_query,
        date_started=incident.date_started,
        current_end_date=incident.current_end_date,
        organization=organization,
        project_ids=project_ids,
        start_arg=start,
        end_arg=end,
    )
    return get_metric_issue_aggregates(params).get("count")


def get_incident_status_text(
    snuba_query: SnubaQuery,
    threshold_type: AlertRuleThresholdType | None,
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
        metric_and_agg_text = f"{metric_value}{agg_text}"
    else:
        metric_and_agg_text = f"{metric_value} {agg_text}"

    time_window = snuba_query.time_window // 60
    # % change alerts have a comparison delta
    if comparison_delta:
        metric_and_agg_text = f"{agg_text.capitalize()} {int(float(metric_value))}%"
        higher_or_lower = "higher" if threshold_type == AlertRuleThresholdType.ABOVE else "lower"
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
    identifier_id: int, organization: Organization, params: TitleLinkParams
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
    alert_context: AlertContext,
    open_period_params: OpenPeriodParams,
    organization: Organization,
    snuba_query: SnubaQuery,
    metric_value: float | None = None,
    referrer: str = "metric_alert",
    notification_uuid: str | None = None,
) -> AttachmentInfo:
    status = get_status_text(open_period_params.new_status)

    text = ""
    if metric_value is not None:
        text = get_incident_status_text(
            snuba_query,
            alert_context.threshold_type,
            alert_context.comparison_delta,
            str(metric_value),
        )

    if features.has("organizations:anomaly-detection-alerts", organization) and features.has(
        "organizations:anomaly-detection-rollout", organization
    ):
        text += f"\nThreshold: {alert_context.detection_type.title()}"

    title = get_title(status, alert_context.name)

    title_link_params: TitleLinkParams = {
        "alert": str(open_period_params.open_period_identifier_id),
        "referrer": referrer,
        "detection_type": alert_context.detection_type.value,
    }
    if notification_uuid:
        title_link_params["notification_uuid"] = notification_uuid

    title_link = build_title_link(
        str(alert_context.action_identifier_id), organization, title_link_params
    )

    return AttachmentInfo(
        title=title,
        text=text,
        logo_url=logo_url(),
        status=status,
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
            incident_info: Incident | None = latest_incident
        else:
            incident_info = selected_incident

        if incident_info:
            # TODO(iamrajjoshi): Hoist FK lookup up
            metric_value = get_metric_count_from_incident(incident_info)

    text = ""
    if metric_value is not None and status != INCIDENT_STATUS[IncidentStatus.CLOSED]:
        text = get_incident_status_text(
            alert_rule.snuba_query,
            (
                AlertRuleThresholdType(alert_rule.threshold_type)
                if alert_rule.threshold_type is not None
                else None
            ),
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
