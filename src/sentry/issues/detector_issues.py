from collections.abc import Mapping
from uuid import uuid4

from sentry.incidents.models.incident import INCIDENT_STATUS, Incident, IncidentStatus
from sentry.issues.grouptype import DetectorControlledIssueType
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.models.project import Project
from sentry.types.group import PriorityLevel


def build_fingerprint_from_incident(
    alert_rule_id: int, data: Mapping[str, str | int] | None = None
) -> list[str]:
    """
    Build a fingerprint from the alert rule id and any additional key-value pairs
    that are passed in.

    Note that the order of the items in the fingerprint must be sorted alphabetically to
    ensure that the fingerprint is consistent.
    """
    data = dict(sorted(data.items())) if data else {}
    return [str(alert_rule_id)] + [f"{key}:{value}" for key, value in data.items()]


def build_occurrence_from_incident(
    project: Project, incident: Incident, event_data: Mapping[str, str | int]
) -> IssueOccurrence:
    initial_issue_priority = (
        PriorityLevel.HIGH if incident.status == IncidentStatus.CRITICAL else PriorityLevel.MEDIUM
    )
    subtitle = f"Alert rule exceeded {INCIDENT_STATUS[incident.status].lower()} threshold"
    return IssueOccurrence(
        id=uuid4().hex,
        project_id=project.id,
        event_id=event_data["event_id"],
        fingerprint=build_fingerprint_from_incident(incident.alert_rule.id),
        issue_title=incident.title,
        subtitle=subtitle,
        resource_id=None,
        type=DetectorControlledIssueType,
        detection_time=event_data["timestamp"],
        level="error",
        culprit=None,
        initial_issue_priority=initial_issue_priority,
        # TODO(snigdha): Add more data here as needed
        evidence_data={},
        evidence_display=[],
    )


def create_detector_issue_occurrence(incident: Incident) -> None:
    project = incident.alert_rule.projects.first()

    # collect the data from the incident to treat as an event
    event_data = {
        "event_id": uuid4().hex,
        "project_id": project.id,
        "timestamp": incident.date_started,
        "platform": project.platform,
    }
    occurrence = build_occurrence_from_incident(project, incident, event_data)
    produce_occurrence_to_kafka(
        payload_type=PayloadType.OCCURRENCE,
        occurrence=occurrence,
        event_data=event_data,
    )
