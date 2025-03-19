from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any
from uuid import uuid4

from django.utils.translation import gettext as _

from sentry import features
from sentry.constants import CRASH_RATE_ALERT_AGGREGATE_ALIAS
from sentry.incidents.models.alert_rule import AlertRule, AlertRuleThresholdType, AlertRuleTrigger
from sentry.incidents.models.incident import INCIDENT_STATUS, Incident, IncidentStatus
from sentry.incidents.utils.format_duration import format_duration_idiomatic
from sentry.integrations.metric_alerts import TEXT_COMPARISON_DELTA
from sentry.issues.grouptype import MetricIssuePOC
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.models.group import GroupStatus
from sentry.models.project import Project
from sentry.snuba.metrics import format_mri_field, is_mri_field
from sentry.types.group import PriorityLevel


@dataclass
class OpenPeriod:
    start: datetime
    end: datetime | None
    duration: timedelta | None
    is_open: bool
    last_checked: datetime

    def to_dict(self) -> dict[str, Any]:
        return {
            "start": self.start,
            "end": self.end,
            "duration": self.duration,
            "isOpen": self.is_open,
            "lastChecked": self.last_checked,
        }


QUERY_AGGREGATION_DISPLAY = {
    "count()": "Number of events",
    "count_unique(tags[sentry:user])": "Number of users affected",
    "percentage(sessions_crashed, sessions)": "Crash free session rate",
    "percentage(users_crashed, users)": "Crash free user rate",
    "failure_rate()": "Failure rate",
    "apdex()": "Apdex score",
}


def construct_title(alert_rule: AlertRule, status: int) -> str:
    # Parse the aggregate key from the alert rule
    agg_display_key = alert_rule.snuba_query.aggregate
    if is_mri_field(agg_display_key):
        aggregate = format_mri_field(agg_display_key)
    elif CRASH_RATE_ALERT_AGGREGATE_ALIAS in agg_display_key:
        agg_display_key = agg_display_key.split(f"AS {CRASH_RATE_ALERT_AGGREGATE_ALIAS}")[0].strip()
        aggregate = QUERY_AGGREGATION_DISPLAY.get(agg_display_key, agg_display_key)
    else:
        aggregate = QUERY_AGGREGATION_DISPLAY.get(agg_display_key, alert_rule.snuba_query.aggregate)

    # Determine the higher or lower comparison
    higher_or_lower = ""
    if alert_rule.threshold_type == AlertRuleThresholdType.ABOVE.value:
        higher_or_lower = "greater than" if alert_rule.comparison_delta else "above"
    else:
        higher_or_lower = "less than" if alert_rule.comparison_delta else "below"

    label = INCIDENT_STATUS[IncidentStatus(status)]

    # Format the time window for the threshold
    time_window = format_duration_idiomatic(alert_rule.snuba_query.time_window // 60)

    # If the alert rule has a comparison delta, format the comparison string
    comparison: str | int | float = "threshold"
    if alert_rule.comparison_delta:
        comparison_delta_minutes = alert_rule.comparison_delta // 60
        comparison = TEXT_COMPARISON_DELTA.get(
            comparison_delta_minutes, f"same time {comparison_delta_minutes} minutes ago "
        )
    else:
        # Otherwise, check if there is a trigger with a threshold
        trigger = AlertRuleTrigger.objects.filter(id=alert_rule.id, label=label.lower()).first()
        if trigger:
            threshold = trigger.alert_threshold
            comparison = int(threshold) if threshold % 1 == 0 else threshold

    template = "{label}: {metric} in the last {time_window} {higher_or_lower} {comparison}"
    return _(
        template.format(
            label=label.capitalize(),
            metric=aggregate,
            higher_or_lower=higher_or_lower,
            comparison=comparison,
            time_window=time_window,
        )
    )


def _build_occurrence_from_incident(
    project: Project,
    incident: Incident,
    event_data: dict[str, str | int],
    metric_value: float,
) -> IssueOccurrence:
    initial_issue_priority = (
        PriorityLevel.HIGH
        if incident.status == IncidentStatus.CRITICAL.value
        else PriorityLevel.MEDIUM
    )
    fingerprint = [str(incident.alert_rule.id)]
    title = construct_title(incident.alert_rule, incident.status)
    return IssueOccurrence(
        id=uuid4().hex,
        project_id=project.id,
        event_id=str(event_data["event_id"]),
        fingerprint=fingerprint,
        issue_title=incident.title,
        subtitle=title,
        resource_id=None,
        type=MetricIssuePOC,
        detection_time=incident.date_started,
        level="error",
        culprit="",
        initial_issue_priority=initial_issue_priority,
        # TODO(snigdha): Add more data here as needed
        evidence_data={"metric_value": metric_value, "alert_rule_id": incident.alert_rule.id},
        evidence_display=[],
        assignee=incident.alert_rule.owner if incident.alert_rule else None,
    )


def create_or_update_metric_issue(
    incident: Incident,
    metric_value: float,
) -> IssueOccurrence | None:
    project = incident.alert_rule.projects.first()
    if not project:
        return None

    if not features.has("projects:metric-issue-creation", project):
        # We've already checked for the feature flag at the organization level,
        # but this flag helps us test with a smaller set of projects.
        return None

    # collect the data from the incident to treat as an event
    event_data: dict[str, Any] = {
        "event_id": uuid4().hex,
        "project_id": project.id,
        "timestamp": incident.date_started.isoformat(),
        "platform": project.platform or "",
        "received": incident.date_started.isoformat(),
        "contexts": {"metric_alert": {"alert_rule_id": incident.alert_rule.id}},
    }

    occurrence = _build_occurrence_from_incident(project, incident, event_data, metric_value)
    produce_occurrence_to_kafka(
        payload_type=PayloadType.OCCURRENCE,
        occurrence=occurrence,
        event_data=event_data,
    )
    update_group_status(incident, project, occurrence)

    return occurrence


def update_group_status(
    incident: Incident, project: Project, occurrence: IssueOccurrence
) -> StatusChangeMessage | None:
    if incident.status != IncidentStatus.CLOSED.value:
        return None

    status_change_message = StatusChangeMessage(
        fingerprint=occurrence.fingerprint,
        project_id=project.id,
        new_status=GroupStatus.RESOLVED,
        new_substatus=None,
    )
    produce_occurrence_to_kafka(
        payload_type=PayloadType.STATUS_CHANGE,
        status_change=status_change_message,
    )

    return status_change_message
