import logging
import uuid
from enum import StrEnum
from typing import Any

from django.utils import timezone

from sentry.autopilot.grouptype import InstrumentationIssueExperimentalGroupType
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.models.project import Project

logger = logging.getLogger(__name__)


class AutopilotDetectorName(StrEnum):
    SDK_UPDATE = "sdk-update"
    MISSING_SDK_INTEGRATION = "missing-sdk-integration"
    TRACE_INSTRUMENTATION = "trace-instrumentation"


def create_instrumentation_issue(
    project_id: int,
    detector_name: str,
    title: str,
    subtitle: str,
    description: str | None = None,
    repository_name: str | None = None,
) -> None:
    detection_time = timezone.now()
    event_id = uuid.uuid4().hex

    # Fetch the project to get its platform
    project = Project.objects.get_from_cache(id=project_id)

    evidence_data: dict[str, Any] = {}
    evidence_display: list[IssueEvidence] = []

    if description:
        evidence_data["description"] = description
        evidence_display.append(
            IssueEvidence(name="Description", value=description, important=True)
        )

    if repository_name:
        evidence_data["repository_name"] = repository_name
        evidence_display.append(
            IssueEvidence(name="Repository", value=repository_name, important=False)
        )

    occurrence = IssueOccurrence(
        id=uuid.uuid4().hex,
        project_id=project_id,
        event_id=event_id,
        fingerprint=[f"{detector_name}:{title}"],
        issue_title=title,
        subtitle=subtitle,
        resource_id=None,
        evidence_data=evidence_data,
        evidence_display=evidence_display,
        type=InstrumentationIssueExperimentalGroupType,
        detection_time=detection_time,
        culprit=detector_name,
        level="info",
    )

    event_data: dict[str, Any] = {
        "event_id": occurrence.event_id,
        "project_id": occurrence.project_id,
        "platform": project.platform or "other",
        "received": detection_time.isoformat(),
        "timestamp": detection_time.isoformat(),
        "tags": {},
    }

    produce_occurrence_to_kafka(
        payload_type=PayloadType.OCCURRENCE,
        occurrence=occurrence,
        event_data=event_data,
    )

    logger.warning(
        "autopilot.instrumentation_issue.created",
        extra={
            "project_id": project_id,
            "detector_name": detector_name,
            "title": title,
        },
    )
