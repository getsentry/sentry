from __future__ import annotations

from datetime import datetime
from typing import NotRequired, TypedDict, get_args

from django.utils.translation import gettext as _

from sentry import features
from sentry.constants import CRASH_RATE_ALERT_AGGREGATE_ALIAS
from sentry.discover.arithmetic import (
    ArithmeticError,
    is_equation,
    parse_arithmetic,
    strip_equation,
)
from sentry.incidents.models.incident import INCIDENT_STATUS, IncidentStatus
from sentry.incidents.typings.metric_detector import AlertContext, MetricIssueContext
from sentry.incidents.utils.format_duration import format_duration_idiomatic
from sentry.models.organization import Organization
from sentry.notifications.utils.links import create_link_to_workflow
from sentry.search.eap.trace_metrics.definitions import TRACE_METRICS_DEFINITIONS
from sentry.search.eap.trace_metrics.types import TraceMetricType
from sentry.search.events.fields import is_function, parse_arguments
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics import format_mri_field, format_mri_field_value, is_mri_field
from sentry.snuba.metrics.naming_layer.mri import parse_mri_field
from sentry.snuba.models import SnubaQuery, SnubaQueryEventType
from sentry.utils.assets import get_asset_url
from sentry.utils.http import absolute_uri

# Stored forms of aggregates that users never see. The monitor form shows the key instead.
_CRASH_FREE_RATE_AGGREGATES = {
    "percentage(sessions_crashed, sessions)": "crash_free_rate(session)",
    "percentage(users_crashed, users)": "crash_free_rate(user)",
}
_PERCENT_AGGREGATES = {"failure_rate()", *_CRASH_FREE_RATE_AGGREGATES.values()}


def _format_trace_metric_function(function_call: str) -> str:
    # Trace metric functions end with (value, metric name, metric type, metric unit), after any
    # leading arguments such as count_if's filter. Users know the metric by its name alone.
    match = is_function(function_call)
    if match is None:
        return function_call
    function = match.group("function")
    arguments = parse_arguments(function, match.group("columns"))
    if len(arguments) < 4 or arguments[-2] not in get_args(TraceMetricType):
        return function_call
    return f"{function}({','.join([*arguments[:-4], arguments[-3]])})"


def _format_trace_metric_aggregate(aggregate: str) -> str:
    if not is_equation(aggregate):
        return _format_trace_metric_function(aggregate)
    equation = strip_equation(aggregate)
    try:
        _, _, function_calls = parse_arithmetic(equation, definitions=TRACE_METRICS_DEFINITIONS)
    except ArithmeticError:
        return equation
    for function_call in function_calls:
        equation = equation.replace(function_call, _format_trace_metric_function(function_call))
    return equation


def format_aggregate(aggregate: str, *, trace_metric: bool = False) -> str:
    """The aggregate as the monitor form shows it, e.g. `count_unique(user)`."""
    aggregate = aggregate.split(f"AS {CRASH_RATE_ALERT_AGGREGATE_ALIAS}")[0].strip()
    if is_mri_field(aggregate):
        return format_mri_field(aggregate)
    if trace_metric:
        return _format_trace_metric_aggregate(aggregate)
    if is_equation(aggregate):
        return strip_equation(aggregate)
    aggregate = _CRASH_FREE_RATE_AGGREGATES.get(aggregate, aggregate)
    return aggregate.replace("(tags[sentry:user])", "(user)")


# Release health datasets hold session data; crash rate aggregates are computed from sessions.
_DATASET_TELEMETRY = {
    Dataset.Events: "errors",
    Dataset.IssuePlatform: "issue occurrences",
    Dataset.Transactions: "transactions",
    Dataset.PerformanceMetrics: "transactions",
    Dataset.Metrics: "sessions",
    Dataset.Sessions: "sessions",
}


_TRACE_METRIC_TELEMETRY = "application metrics"


def get_query_telemetry(snuba_query: SnubaQuery) -> str:
    """The kind of telemetry a query measures, e.g. "logs" or "errors"."""
    # An MRI names its own namespace, and one metrics dataset holds several.
    if parsed_mri := parse_mri_field(snuba_query.aggregate):
        namespace = parsed_mri.mri.namespace
        return "custom metrics" if namespace == "custom" else namespace

    dataset = Dataset(snuba_query.dataset)
    if dataset == Dataset.EventsAnalyticsPlatform:
        event_types = snuba_query.event_types
        if SnubaQueryEventType.EventType.TRACE_ITEM_LOG in event_types:
            return "logs"
        if SnubaQueryEventType.EventType.TRACE_ITEM_METRIC in event_types:
            return _TRACE_METRIC_TELEMETRY
        return "spans"
    return _DATASET_TELEMETRY.get(dataset, "events")


def describe_query_metric(snuba_query: SnubaQuery) -> str:
    """What a query measures, e.g. `count(message) of logs`."""
    telemetry = get_query_telemetry(snuba_query)
    aggregate = format_aggregate(
        snuba_query.aggregate, trace_metric=telemetry == _TRACE_METRIC_TELEMETRY
    )
    return f"{aggregate} of {telemetry}"


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


def logo_url() -> str:
    return absolute_uri(get_asset_url("sentry", "images/sentry-email-avatar.png"))


def get_incident_status_text(
    snuba_query: SnubaQuery,
    comparison_delta: int | None,
    metric_value: str,
) -> str:
    """Returns a human readable current status of an incident"""
    aggregate = format_aggregate(snuba_query.aggregate)
    metric = describe_query_metric(snuba_query)

    time_window = snuba_query.time_window // 60
    # % change alerts have a comparison delta, and their values are the current value as a
    # percentage of the comparison value (150 is 50% higher), not values in the aggregate's unit.
    if comparison_delta:
        change = float(metric_value) - 100
        higher_or_lower = "higher" if change >= 0 else "lower"
        if aggregate == "failure_rate()":
            metric_value = f"{abs(change):.2f}%"
        else:
            metric_value = f"{round(abs(change))}%"
        comparison_delta_minutes = comparison_delta // 60
        comparison_string = TEXT_COMPARISON_DELTA.get(
            comparison_delta_minutes, f"same time {comparison_delta_minutes} minutes ago"
        )
        return _(
            f"{metric} was {metric_value} {higher_or_lower} in the last {format_duration_idiomatic(time_window)} "
            f"compared to the {comparison_string}"
        )

    if is_mri_field(snuba_query.aggregate):
        metric_value = format_mri_field_value(snuba_query.aggregate, metric_value)
    elif aggregate == "failure_rate()":
        metric_value = f"{float(metric_value) * 100:.2f}"
    if aggregate in _PERCENT_AGGREGATES:
        metric_value = f"{metric_value}%"

    return _(f"{metric} was {metric_value} in the last {format_duration_idiomatic(time_window)}")


def get_status_text(status: IncidentStatus) -> str:
    return INCIDENT_STATUS[status]


def get_title(status: str, name: str) -> str:
    return f"{status}: {name}"


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
            alert_context.comparison_delta,
            str(metric_issue_context.metric_value),
        )

    if features.has("organizations:anomaly-detection-alerts", organization):
        text += f"\nThreshold: {alert_context.detection_type.title()}"

    title = get_title(status, alert_context.name)

    group = metric_issue_context.group
    if group is None:
        raise ValueError("Metric alert notifications require a group")

    title_link_params = {
        "referrer": referrer,
        "detection_type": alert_context.detection_type.value,
        "openPeriod": str(metric_issue_context.open_period_identifier),
    }
    if notification_uuid:
        title_link_params["notification_uuid"] = notification_uuid

    title_link = group.get_absolute_url(params=title_link_params)

    return AttachmentInfo(
        title=title,
        text=text,
        logo_url=logo_url(),
        status=status,
        title_link=title_link,
    )
