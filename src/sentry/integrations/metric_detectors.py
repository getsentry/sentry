from __future__ import annotations

from datetime import datetime
from typing import NotRequired, TypedDict

from django.utils.translation import gettext as _

from sentry.constants import CRASH_RATE_ALERT_AGGREGATE_ALIAS
from sentry.incidents.models.alert_rule import AlertRuleThresholdType
from sentry.incidents.models.incident import INCIDENT_STATUS, IncidentStatus
from sentry.incidents.typings.metric_detector import AlertContext, MetricIssueContext
from sentry.incidents.utils.format_duration import format_duration_idiomatic
from sentry.models.organization import Organization
from sentry.seer.anomaly_detection.types import AnomalyDetectionThresholdType
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
    identifier_id: int, organization: Organization, project_id: int, params: TitleLinkParams
) -> str:
    """Builds the URL for the metric issue with the given parameters."""
    return organization.absolute_url(
        reverse(
            "sentry-group",
            kwargs={
                "organization_slug": organization.slug,
                "project_id": project_id,
                "group_id": identifier_id,
            },
        ),
        query=parse.urlencode(params),
    )


def open_period_attachment_info(
    organization: Organization,
    alert_context: AlertContext,
    metric_issue_context: MetricIssueContext,  # is this going to be a problem?
    referrer: str = "metric_alert",  # should this be smth else?
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

    title_link_params: TitleLinkParams = {
        "alert": str(metric_issue_context.open_period_identifier),
        "referrer": referrer,
        "detection_type": alert_context.detection_type.value,
    }
    if notification_uuid:
        title_link_params["notification_uuid"] = notification_uuid

    if metric_issue_context.group is None:
        raise ValueError("Group is required for workflow engine UI links")

    # We don't need to save the query param the alert rule id here because the link is to the group and not the alert rule
    # TODO(iamrajjoshi): This this through and perhaps
    workflow_engine_ui_params = title_link_params.copy()
    workflow_engine_ui_params.pop("alert", None)

    title_link = build_title_link(
        metric_issue_context.group.id,
        organization,
        metric_issue_context.group.project.id,
        workflow_engine_ui_params,
    )
