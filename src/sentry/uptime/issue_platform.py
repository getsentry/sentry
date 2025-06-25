from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sentry_kafka_schemas.schema_types.uptime_results_v1 import CheckResult

from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.models.group import GroupStatus
from sentry.uptime.grouptype import (
    UptimeDomainCheckFailure,
    build_event_data,
    build_evidence_display,
    build_fingerprint,
)
from sentry.uptime.models import get_uptime_subscription
from sentry.workflow_engine.models.detector import Detector

# XXX(epurkhiser): This module supports the legacy issue creation of uptime
# failures NOT using the uptime detector handler. In the future this module
# will be removed.


def create_issue_platform_occurrence(result: CheckResult, detector: Detector):
    occurrence = build_occurrence_from_result(result, detector)
    event_data = build_event_data_for_occurrence(result, detector, occurrence)
    produce_occurrence_to_kafka(
        payload_type=PayloadType.OCCURRENCE,
        occurrence=occurrence,
        event_data=event_data,
    )


def build_occurrence_from_result(result: CheckResult, detector: Detector) -> IssueOccurrence:
    uptime_subscription = get_uptime_subscription(detector)

    return IssueOccurrence(
        id=uuid.uuid4().hex,
        resource_id=None,
        project_id=detector.project_id,
        event_id=uuid.uuid4().hex,
        fingerprint=build_fingerprint(detector),
        type=UptimeDomainCheckFailure,
        issue_title=f"Downtime detected for {uptime_subscription.url}",
        subtitle="Your monitored domain is down",
        evidence_display=build_evidence_display(result),
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
    common_event_data = build_event_data(result, detector)

    return {
        **common_event_data,
        "event_id": occurrence.event_id,
        "fingerprint": occurrence.fingerprint,
        "timestamp": occurrence.detection_time.isoformat(),
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
