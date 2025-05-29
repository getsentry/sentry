from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sentry_kafka_schemas.schema_types.uptime_results_v1 import CheckResult

from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.models.group import GroupStatus
from sentry.uptime.grouptype import UptimeDomainCheckFailure
from sentry.uptime.models import get_project_subscription, get_uptime_subscription
from sentry.workflow_engine.models.detector import Detector


def create_issue_platform_occurrence(result: CheckResult, detector: Detector):
    occurrence = build_occurrence_from_result(result, detector)
    event_data = build_event_data_for_occurrence(result, detector, occurrence)
    produce_occurrence_to_kafka(
        payload_type=PayloadType.OCCURRENCE,
        occurrence=occurrence,
        event_data=event_data,
    )


def build_detector_fingerprint_component(detector: Detector) -> str:
    return f"uptime-detector:{detector.id}"


def build_fingerprint(detector: Detector) -> list[str]:
    return [build_detector_fingerprint_component(detector)]


def build_occurrence_from_result(result: CheckResult, detector: Detector) -> IssueOccurrence:
    uptime_subscription = get_uptime_subscription(detector)
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
            value=f"{result["duration_ms"]}ms",
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
        project_id=detector.project_id,
        event_id=uuid.uuid4().hex,
        fingerprint=build_fingerprint(detector),
        type=UptimeDomainCheckFailure,
        issue_title=f"Downtime detected for {uptime_subscription.url}",
        subtitle="Your monitored domain is down",
        evidence_display=evidence_display,
        evidence_data={},
        culprit="",  # TODO: The url?
        detection_time=datetime.now(timezone.utc),
        level="error",
        assignee=detector.owner,
    )


def build_event_data_for_occurrence(
    result: CheckResult,
    detector: Detector,
    occurrence: IssueOccurrence,
):
    # Default environment when it hasn't been configured
    env = detector.config.get("environment", "prod")

    # XXX(epurkhiser): This can be changed over to using the detector ID in the
    # future once we're no longer using the ProjectUptimeSubscription.id as a tag.
    project_subscription = get_project_subscription(detector)

    return {
        "environment": env,
        "event_id": occurrence.event_id,
        "fingerprint": occurrence.fingerprint,
        "platform": "other",
        "project_id": occurrence.project_id,
        # We set this to the time that the check was performed
        "received": datetime.fromtimestamp(result["actual_check_time_ms"] / 1000),
        "sdk": None,
        "tags": {
            "uptime_rule": str(project_subscription.id),
        },
        "timestamp": occurrence.detection_time.isoformat(),
        "contexts": {"trace": {"trace_id": result["trace_id"], "span_id": result.get("span_id")}},
    }


def resolve_uptime_issue(detector: Detector):
    """
    Sends an update to the issue platform to resolve the uptime issue for this monitor.
    """
    status_change = StatusChangeMessage(
        fingerprint=build_fingerprint(detector),
        project_id=detector.project_id,
        new_status=GroupStatus.RESOLVED,
        new_substatus=None,
    )
    produce_occurrence_to_kafka(
        payload_type=PayloadType.STATUS_CHANGE,
        status_change=status_change,
    )
