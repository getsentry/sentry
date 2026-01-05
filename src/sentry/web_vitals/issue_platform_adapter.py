import hashlib
from datetime import UTC, datetime
from uuid import uuid4

import sentry_sdk

from sentry.issues.grouptype import WebVitalsGroup
from sentry.issues.ingest import hash_fingerprint
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.models.group import Group, GroupStatus
from sentry.web_vitals.types import WebVitalIssueDetectionGroupingType, WebVitalIssueGroupData


def create_fingerprint(vital_grouping: WebVitalIssueDetectionGroupingType, transaction: str) -> str:
    prehashed_fingerprint = f"insights-web-vitals-{vital_grouping}-{transaction}"
    fingerprint = hashlib.sha1((prehashed_fingerprint).encode()).hexdigest()
    return fingerprint


@sentry_sdk.tracing.trace
def send_web_vitals_issue_to_platform(data: WebVitalIssueGroupData, trace_id: str) -> bool:
    project = data["project"]
    sentry_sdk.set_tag("project_id", project.id)
    sentry_sdk.set_tag("organization_id", project.organization_id)

    # Do not create a new web vital issue if an open issue already exists
    if check_unresolved_web_vitals_issue_exists(data):
        return False

    event_id = uuid4().hex
    now = datetime.now(UTC)
    transaction = data["transaction"]
    scores = data["scores"]
    values = data["values"]

    tags = {
        "transaction": data["transaction"],
    }

    # These should already match, but use the intersection to be safe
    vitals = scores.keys() & values.keys()
    for vital in vitals:
        tags[f"{vital}_score"] = f"{scores[vital]:.2g}"
        tags[vital] = f"{values[vital]}"

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
    if data["vital_grouping"] == "rendering":
        title = f"The page {transaction} was slow to load and render"
    elif data["vital_grouping"] == "cls":
        title = f"The page {transaction} had layout shifts while loading"
    elif data["vital_grouping"] == "inp":
        title = f"The page {transaction} responded slowly to user interactions"
    else:
        raise ValueError(f"Invalid vital grouping: {data['vital_grouping']}")
    subtitle_parts = []
    for vital in data["scores"]:
        a_or_an = "an" if vital in ("lcp", "fcp", "inp") else "a"
        subtitle_parts.append(f"{a_or_an} {vital.upper()} score of {data['scores'][vital]:.2g}")
    if len(subtitle_parts) > 1:
        scores_text = ", ".join(subtitle_parts[:-1]) + " and " + subtitle_parts[-1]
    else:
        scores_text = subtitle_parts[0]
    subtitle = f"{transaction} has {scores_text}"

    fingerprint = create_fingerprint(data["vital_grouping"], transaction)

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

    return True


def check_unresolved_web_vitals_issue_exists(data: WebVitalIssueGroupData) -> bool:
    fingerprint = create_fingerprint(data["vital_grouping"], data["transaction"])
    fingerprint_hash = hash_fingerprint([fingerprint])[0]

    return Group.objects.filter(
        grouphash__project_id=data["project"].id,
        grouphash__hash=fingerprint_hash,
        status=GroupStatus.UNRESOLVED,
    ).exists()
