import hashlib
import uuid
from datetime import datetime, timezone
from typing import Type

from sentry.issues.grouptype import (
    GroupType,
    PerformanceDurationRegressionGroupType,
    PerformanceP95EndpointRegressionGroupType,
)
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.seer.utils import BreakpointData
from sentry.utils import metrics


def fingerprint_regression(transaction, full=False):
    prehashed_fingerprint = f"p95_transaction_duration_regression-{transaction}"
    fingerprint = hashlib.sha1((prehashed_fingerprint).encode()).hexdigest()
    if not full:
        fingerprint = fingerprint[:16]
    return fingerprint


def send_regression_to_platform(regression: BreakpointData, released: bool):
    current_timestamp = datetime.utcnow().replace(tzinfo=timezone.utc)

    displayed_old_baseline = round(float(regression["aggregate_range_1"]), 2)
    displayed_new_baseline = round(float(regression["aggregate_range_2"]), 2)

    # For legacy reasons, we're passing project id as project
    # TODO fix this in the breakpoint microservice and in trends v2
    project_id = int(regression["project"])

    issue_type: Type[GroupType] = (
        PerformanceP95EndpointRegressionGroupType
        if released
        else PerformanceDurationRegressionGroupType
    )

    occurrence = IssueOccurrence(
        id=uuid.uuid4().hex,
        resource_id=None,
        project_id=project_id,
        event_id=uuid.uuid4().hex,
        # This uses the full fingerprint to avoid creating a new group for existing
        # issues but in theory this could be switched to the abbreviated fingerprint.
        fingerprint=[fingerprint_regression(regression["transaction"], full=True)],
        type=issue_type,
        issue_title=issue_type.description,
        subtitle=f"Increased from {displayed_old_baseline}ms to {displayed_new_baseline}ms (P95)",
        culprit=regression["transaction"],
        evidence_data=regression,
        evidence_display=[
            IssueEvidence(
                name="Regression",
                value=f'{regression["transaction"]} duration increased from {displayed_old_baseline}ms to {displayed_new_baseline}ms (P95)',
                important=True,
            ),
            IssueEvidence(
                name="Transaction",
                value=regression["transaction"],
                important=True,
            ),
        ],
        detection_time=current_timestamp,
        level="info",
    )

    event_data = {
        "timestamp": current_timestamp,
        "project_id": project_id,
        "transaction": regression["transaction"],
        "event_id": occurrence.event_id,
        "platform": "python",
        "received": current_timestamp.isoformat(),
        "tags": {},
    }

    metrics.incr("performance.trends.sent_occurrence")

    produce_occurrence_to_kafka(
        payload_type=PayloadType.OCCURRENCE, occurrence=occurrence, event_data=event_data
    )
