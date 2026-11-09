from __future__ import annotations

from datetime import datetime
from typing import NotRequired, TypedDict
from urllib import parse

from django.urls import reverse
from django.utils.translation import gettext as _

from sentry import features
from sentry.constants import CRASH_RATE_ALERT_AGGREGATE_ALIAS
from sentry.discover.arithmetic import is_equation, strip_equation
from sentry.incidents.endpoints.serializers.utils import get_fake_id_from_object_id
from sentry.incidents.models.alert_rule import AlertRuleThresholdType
from sentry.incidents.models.incident import INCIDENT_STATUS, IncidentStatus
from sentry.incidents.typings.metric_detector import AlertContext, MetricIssueContext
from sentry.incidents.utils.format_duration import format_duration_idiomatic
from sentry.models.organization import Organization
from sentry.notifications.utils.links import create_link_to_workflow
from sentry.seer.anomaly_detection.types import AnomalyDetectionThresholdType
from sentry.snuba.metrics import format_mri_field, format_mri_field_value, is_mri_field
from sentry.snuba.models import SnubaQuery
from sentry.utils.assets import get_asset_url
from sentry.utils.http import absolute_uri
from sentry.workflow_engine.models.alertrule_detector import AlertRuleDetector
from sentry.workflow_engine.models.incident_groupopenperiod import IncidentGroupOpenPeriod

# Stored forms of aggregates that users never see. The monitor form shows the key instead.
_CRASH_FREE_RATE_AGGREGATES = {
    "percentage(sessions_crashed, sessions)": "crash_free_rate(session)",
    "percentage(users_crashed, users)": "crash_free_rate(user)",
}
_PERCENT_AGGREGATES = {"failure_rate()", *_CRASH_FREE_RATE_AGGREGATES.values()}


def format_aggregate(aggregate: str) -> str:
    """The aggregate as the monitor form shows it, e.g. `count_unique(user)`."""
    aggregate = aggregate.split(f"AS {CRASH_RATE_ALERT_AGGREGATE_ALIAS}")[0].strip()
    if is_mri_field(aggregate):
        return format_mri_field(aggregate)
    if is_equation(aggregate):
        return strip_equation(aggregate)
    aggregate = _CRASH_FREE_RATE_AGGREGATES.get(aggregate, aggregate)
    return aggregate.replace("(tags[sentry:user])", "(user)")


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
    project_id: int | None


def logo_url() -> str:
    return absolute_uri(get_asset_url("sentry", "images/sentry-email-avatar.png"))


def get_incident_status_text(
    snuba_query: SnubaQuery,
    threshold_type: AlertRuleThresholdType | AnomalyDetectionThresholdType | None,
    comparison_delta: int | None,
    metric_value: str,
) -> str:
    """Returns a human readable current status of an incident"""
    aggregate = format_aggregate(snuba_query.aggregate)

    if is_mri_field(snuba_query.aggregate):
        metric_value = format_mri_field_value(snuba_query.aggregate, metric_value)
    elif aggregate == "failure_rate()" and not comparison_delta:
        metric_value = f"{float(metric_value) * 100:.2f}"

    if aggregate in _PERCENT_AGGREGATES:
        metric_and_agg_text = f"{metric_value}% {aggregate}"
    else:
        metric_and_agg_text = f"{metric_value} {aggregate}"

    time_window = snuba_query.time_window // 60
    # % change alerts have a comparison delta
    if comparison_delta:
        if aggregate == "failure_rate()":
            metric_and_agg_text = f"{aggregate} {float(metric_value):.2f}%"
        else:
            metric_and_agg_text = f"{aggregate} {int(float(metric_value))}%"
        higher_or_lower = (
            "higher"
            if (
                threshold_type == AlertRuleThresholdType.ABOVE
                or threshold_type == AnomalyDetectionThresholdType.ABOVE
            )
            else "lower"
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


def build_workflow_link(organization: Organization, workflow_id: int) -> str:
    return organization.absolute_url(create_link_to_workflow(organization.slug, str(workflow_id)))


def incident_attachment_info(
    organization: Organization,
    alert_context: AlertContext,
    metric_issue_context: MetricIssueContext,
    referrer: str = "metric_alert",
    notification_uuid: str | None = None,
) -> AttachmentInfo:
    status = get_status_text(metric_issue_context.new_status)

    text = ""
    if metric_issue_context.metric_value is not None:
        text = get_incident_status_text(
            metric_issue_context.snuba_query,
            alert_context.threshold_type,
            alert_context.comparison_delta,
            str(metric_issue_context.metric_value),
        )

    if features.has("organizations:anomaly-detection-alerts", organization):
        text += f"\nThreshold: {alert_context.detection_type.title()}"

    title = get_title(status, alert_context.name)

    title_link_params: TitleLinkParams = {
        "alert": str(metric_issue_context.open_period_identifier),
        "referrer": referrer,
        "detection_type": alert_context.detection_type.value,
    }
    if notification_uuid:
        title_link_params["notification_uuid"] = notification_uuid

    try:
        alert_rule_id = AlertRuleDetector.objects.values_list("alert_rule_id", flat=True).get(
            detector_id=alert_context.action_identifier_id
        )
        if alert_rule_id is None:
            raise ValueError("Alert rule id not found when querying for AlertRuleDetector")
    except AlertRuleDetector.DoesNotExist:
        # the corresponding metric detector was not dual written
        alert_rule_id = get_fake_id_from_object_id(alert_context.action_identifier_id)

    workflow_engine_params = title_link_params.copy()

    try:
        open_period_incident = IncidentGroupOpenPeriod.objects.get(
            group_open_period_id=metric_issue_context.open_period_identifier
        )
        workflow_engine_params["alert"] = str(open_period_incident.incident_identifier)
    except IncidentGroupOpenPeriod.DoesNotExist:
        # the corresponding metric detector was not dual written
        workflow_engine_params["alert"] = str(
            get_fake_id_from_object_id(metric_issue_context.open_period_identifier)
        )

    title_link = build_title_link(alert_rule_id, organization, workflow_engine_params)

    return AttachmentInfo(
        title=title,
        text=text,
        logo_url=logo_url(),
        status=status,
        title_link=title_link,
    )
