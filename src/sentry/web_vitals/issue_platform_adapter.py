from typing import int
import hashlib
from datetime import UTC, datetime
from uuid import uuid4

from sentry.issues.grouptype import WebVitalsGroup
from sentry.issues.ingest import hash_fingerprint
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.models.group import Group, GroupStatus
from sentry.web_vitals.types import WebVitalIssueDetectionType, WebVitalIssueGroupData


def create_fingerprint(vital: WebVitalIssueDetectionType, transaction: str) -> str:
    prehashed_fingerprint = f"insights-web-vitals-{vital}-{transaction}"
    fingerprint = hashlib.sha1((prehashed_fingerprint).encode()).hexdigest()
    return fingerprint


def send_web_vitals_issue_to_platform(data: WebVitalIssueGroupData, trace_id: str) -> None:
    # Do not create a new web vital issue if an open issue already exists
    if check_unresolved_web_vitals_issue_exists(data):
        return

    event_id = uuid4().hex
    now = datetime.now(UTC)
    transaction = data["transaction"]
    vital = data["vital"]

    tags = {
        "transaction": data["transaction"],
        "web_vital": vital,
        "score": f"{data['score']:.2g}",
        vital: f"{data['value']}",
    }

    event_data = {
        "event_id": event_id,
        "project_id": data["project"].id,
        "platform": data["project"].platform,
        "timestamp": now.isoformat(),
        "received": now.isoformat(),
        "tags": tags,
    }

    if trace_id:
        event_data["contexts"] = {
            "trace": {
                "trace_id": trace_id,
                "type": "trace",
            }
        }

    evidence_data = {
        "transaction": transaction,
    }

    evidence_display = [
        IssueEvidence(
            name="Transaction",
            value=transaction,
            important=False,
        ),
    ]

    # TODO: Add better titles and subtitles
    title = f"{data['vital'].upper()} score needs improvement"
    subtitle = f"{transaction} has a {data['vital'].upper()} score of {data['score']:.2g}"

    fingerprint = create_fingerprint(data["vital"], transaction)

    occurence = IssueOccurrence(
        id=uuid4().hex,
        event_id=event_id,
        project_id=data["project"].id,
        fingerprint=[fingerprint],
        issue_title=title,
        subtitle=subtitle,
        resource_id=None,
        evidence_data=evidence_data,
        evidence_display=evidence_display,
        type=WebVitalsGroup,
        detection_time=now,
        culprit=transaction,
        level="info",
    )

    produce_occurrence_to_kafka(
        payload_type=PayloadType.OCCURRENCE, occurrence=occurence, event_data=event_data
    )


def check_unresolved_web_vitals_issue_exists(data: WebVitalIssueGroupData) -> bool:
    fingerprint = create_fingerprint(data["vital"], data["transaction"])
    fingerprint_hash = hash_fingerprint([fingerprint])[0]

    return Group.objects.filter(
        grouphash__project_id=data["project"].id,
        grouphash__hash=fingerprint_hash,
        status=GroupStatus.UNRESOLVED,
    ).exists()
