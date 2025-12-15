from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4

from sentry.issues.grouptype import PreprodDeltaGroupType
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.preprod.size_analysis.models import SizeMetricDiffItem


def diff_to_occurrence(
    project_id: int, size: Literal["install", "download"], diff: SizeMetricDiffItem
) -> tuple[IssueOccurrence, dict[str, Any]]:

    id = uuid4().hex
    event_id = uuid4().hex
    fingerprint = [uuid4().hex]
    current_timestamp = datetime.now(timezone.utc)

    # TODO(EME-80): Unclear if/what we should put in the event_data:
    event_data = {
        "event_id": event_id,
        "project_id": project_id,
        "platform": "other",
        "received": current_timestamp.timestamp(),
        "timestamp": current_timestamp.timestamp(),
    }

    evidence_display = [
        IssueEvidence("some_evidence_name", "some_evidence_data", False),
    ]

    match size:
        case "download":
            delta = diff.head_download_size - diff.base_download_size
        case "install":
            delta = diff.head_install_size - diff.base_install_size
        case _:
            assert False, f"Unknown size {size}"

    occurrence = IssueOccurrence(
        id=id,
        event_id=event_id,
        # TODO(EME-80): Should format title better:
        issue_title=f"{delta} byte {size} size regression",
        subtitle="",
        project_id=project_id,
        fingerprint=fingerprint,
        type=PreprodDeltaGroupType,
        detection_time=current_timestamp,
        evidence_data={},
        evidence_display=evidence_display,
        # TODO(EME-80): Unclear what we should set these to:
        level="error",
        resource_id=None,
        culprit="",
    )

    return occurrence, event_data
