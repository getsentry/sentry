import logging
from uuid import uuid4

from sentry.incidents.models.incident import Incident, IncidentStatus
from sentry.integrations.metric_alerts import get_incident_status_text
from sentry.issues.grouptype import MetricIssuePOC
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.models.group import GroupStatus
from sentry.models.project import Project
from sentry.types.group import PriorityLevel

logger = logging.getLogger(__name__)


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
    return IssueOccurrence(
        id=uuid4().hex,
        project_id=project.id,
        event_id=str(event_data["event_id"]),
        fingerprint=fingerprint,
        issue_title=incident.title,
        subtitle=get_incident_status_text(incident.alert_rule, str(metric_value)),
        resource_id=None,
        type=MetricIssuePOC,
        detection_time=incident.date_started,
        level="error",
        culprit="",
        initial_issue_priority=initial_issue_priority,
        # TODO(snigdha): Add more data here as needed
        evidence_data={"metric_value": metric_value},
        evidence_display=[],
    )


def create_or_update_metric_issue(
    incident: Incident,
    metric_value: float,
) -> IssueOccurrence | None:
    project = incident.alert_rule.projects.first()
    if not project:
        logger.debug("No project found for incident %s", incident.id)
        return None

    # collect the data from the incident to treat as an event
    event_data: dict[str, str | int] = {
        "event_id": uuid4().hex,
        "project_id": project.id,
        "timestamp": incident.date_started.isoformat(),
        "platform": project.platform or "",
        "received": incident.date_started.isoformat(),
    }

    occurrence = _build_occurrence_from_incident(project, incident, event_data, metric_value)
    produce_occurrence_to_kafka(
        payload_type=PayloadType.OCCURRENCE,
        occurrence=occurrence,
        event_data=event_data,
    )
    logger.debug("Created metric issue for alert rule %s", incident.alert_rule.id)
    update_group_status(incident, project, occurrence)

    return occurrence


def update_group_status(
    incident: Incident, project: Project, occurrence: IssueOccurrence
) -> StatusChangeMessage | None:
    if incident.status != IncidentStatus.CLOSED.value:
        logger.debug("Incident %s is not closed, skipping status update", incident.id)
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
    logger.debug("Updated group status to resolved for occurrence %s", occurrence.id)
    return status_change_message
