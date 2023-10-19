import hashlib
import uuid
from datetime import datetime, timezone
from typing import List

from sentry.issues.grouptype import PerformanceDurationRegressionGroupType
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.issues.producer import produce_occurrence_to_kafka
from sentry.seer.utils import BreakpointData
from sentry.utils import metrics


def fingerprint_regression(transaction, automatic_detection=True):
    prehashed_fingerprint = (
        f"p95_transaction_duration_regression-{transaction}"
        if automatic_detection
        else f"p95_transaction_duration_regression-{transaction}-experiment"
    )
    return hashlib.sha1((prehashed_fingerprint).encode()).hexdigest()


# automatic_detection is True for regressions found while running an hourly cron job
# while automatic_detection is False for regressions found via calling trends v2 endpoint
def send_regressions_to_plaform(regressions: List[BreakpointData], automatic_detection=True):
    current_timestamp = datetime.utcnow().replace(tzinfo=timezone.utc)
    for regression in regressions:
        displayed_old_baseline = round(float(regression["aggregate_range_1"]), 2)
        displayed_new_baseline = round(float(regression["aggregate_range_2"]), 2)

        # For legacy reasons, we're passing project id as project
        # TODO fix this in the breakpoint microservice and in trends v2
        project_id = int(regression["project"])

        occurrence = IssueOccurrence(
            id=uuid.uuid4().hex,
            resource_id=None,
            project_id=project_id,
            event_id=uuid.uuid4().hex,
            fingerprint=[fingerprint_regression(regression["transaction"], automatic_detection)],
            type=PerformanceDurationRegressionGroupType,
            issue_title=PerformanceDurationRegressionGroupType.description,
            subtitle=f"Increased from {displayed_old_baseline}ms to {displayed_new_baseline}ms (P95)",
            culprit=regression["transaction"],
            evidence_data=regression,
            evidence_display=[
                IssueEvidence(
                    name="Regression",
                    value=f"Increased from {displayed_old_baseline}ms to {displayed_new_baseline}ms (P95)",
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

        metrics.incr(
            "performance.trends.sent_occurrence", tags={"automatic_detection": automatic_detection}
        )
        produce_occurrence_to_kafka(occurrence, event_data)
