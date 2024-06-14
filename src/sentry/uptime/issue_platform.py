from __future__ import annotations

import uuid
from datetime import datetime, timezone

from django.conf import settings
from sentry_kafka_schemas.schema_types.uptime_results_v1 import CheckResult

from sentry.issues.grouptype import UptimeDomainCheckFailure
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka


def create_issue_platform_occurrence(result: CheckResult):
    occurrence = build_occurrence_from_result(result)
    produce_occurrence_to_kafka(
        payload_type=PayloadType.OCCURRENCE,
        occurrence=occurrence,
        event_data=build_event_data_for_occurrence(result, occurrence),
    )


def build_occurrence_from_result(result: CheckResult) -> IssueOccurrence:
    status_reason = result["status_reason"]
    assert status_reason
    failure_reason = f'{status_reason["type"]} - {status_reason["description"]}'
    evidence_display = [
        IssueEvidence(
            name="Failure reason",
            value=failure_reason,
            important=True,
        ),
        IssueEvidence(
            name="Duration",
            value=str(result["duration_ms"]),
            important=False,
        ),
    ]
    request_info = result["request_info"]
    if request_info:
        evidence_display.append(
            IssueEvidence(
                name="Method",
                value=request_info["request_type"],
                important=False,
            )
        )
        evidence_display.append(
            IssueEvidence(
                name="Status Code",
                value=str(request_info["http_status_code"]),
                important=False,
            ),
        )

    return IssueOccurrence(
        id=uuid.uuid4().hex,
        resource_id=None,
        project_id=settings.UPTIME_POC_PROJECT_ID,  # TODO: Get this from the subscription or subscription like thing
        event_id=uuid.uuid4().hex,
        fingerprint=[
            result["subscription_id"]
        ],  # TODO: Should be the specific monitor id related to the subscription
        type=UptimeDomainCheckFailure,
        issue_title="Uptime Check Failed for https://sentry.io",  # TODO: Get this from the uptime check details
        subtitle="Your monitored domain is down",
        evidence_display=evidence_display,
        evidence_data={},
        culprit="",  # TODO: The url?
        detection_time=datetime.now(timezone.utc),
        level="error",
    )


def build_event_data_for_occurrence(result: CheckResult, occurrence: IssueOccurrence):
    return {
        "environment": "prod",  # TODO: Include the environment here when we have it
        "event_id": occurrence.event_id,
        "fingerprint": occurrence.fingerprint,
        "platform": "other",
        "project_id": occurrence.project_id,
        # We set this to the time that the check was performed
        "received": datetime.fromtimestamp(result["actual_check_time"]),
        "sdk": None,
        "tags": {
            "subscription_id": result["subscription_id"],
        },
        "timestamp": occurrence.detection_time.isoformat(),
        "contexts": {"trace": {"trace_id": result["trace_id"], "span_id": None}},
    }
