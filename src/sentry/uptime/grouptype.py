from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import override

from django.db.models import Q
from sentry_kafka_schemas.schema_types.uptime_results_v1 import CheckResult, CheckStatus

from sentry import options
from sentry.issues.grouptype import GroupCategory, GroupType
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.ratelimits.sliding_windows import Quota
from sentry.types.group import PriorityLevel
from sentry.uptime.endpoints.validators import UptimeDomainCheckFailureValidator
from sentry.uptime.models import UptimeSubscription
from sentry.uptime.types import GROUP_TYPE_UPTIME_DOMAIN_CHECK_FAILURE, UptimeMonitorMode
from sentry.uptime.utils import build_fingerprint
from sentry.utils import metrics
from sentry.workflow_engine.handlers.detector.base import DetectorOccurrence, EventData
from sentry.workflow_engine.handlers.detector.stateful import (
    DetectorThresholds,
    StatefulDetectorHandler,
)
from sentry.workflow_engine.models import DataPacket, Detector
from sentry.workflow_engine.processors.data_condition_group import ProcessedDataConditionGroup
from sentry.workflow_engine.types import (
    DetectorEvaluationResult,
    DetectorGroupKey,
    DetectorPriorityLevel,
    DetectorSettings,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class UptimePacketValue:
    """
    Represents the value passed into the uptime detector
    """

    check_result: CheckResult
    subscription: UptimeSubscription
    metric_tags: dict[str, str]


def build_evidence_display(result: CheckResult) -> list[IssueEvidence]:
    evidence_display: list[IssueEvidence] = []

    status_reason = result["status_reason"]
    if status_reason:
        reason_evidence = IssueEvidence(
            name="Failure reason",
            value=f'{status_reason["type"]} - {status_reason["description"]}',
            important=True,
        )
        evidence_display.extend([reason_evidence])

    duration_evidence = IssueEvidence(
        name="Duration",
        value=f"{result["duration_ms"]}ms",
        important=False,
    )
    evidence_display.append(duration_evidence)

    request_info = result["request_info"]
    if request_info:
        method_evidence = IssueEvidence(
            name="Method",
            value=request_info["request_type"],
            important=False,
        )
        status_code_evidence = IssueEvidence(
            name="Status Code",
            value=str(request_info["http_status_code"]),
            important=False,
        )
        evidence_display.extend([method_evidence, status_code_evidence])

    return evidence_display


def build_event_data(result: CheckResult, detector: Detector) -> EventData:
    # Default environment when it hasn't been configured
    env = detector.config.get("environment", "prod")

    # Received time is the actual time the check was performed.
    received = datetime.fromtimestamp(result["actual_check_time_ms"] / 1000)

    return {
        "project_id": detector.project_id,
        "environment": env,
        "received": received,
        "platform": "other",
        "sdk": None,
        "contexts": {
            "trace": {"trace_id": result["trace_id"], "span_id": result.get("span_id")},
        },
    }


class UptimeDetectorHandler(StatefulDetectorHandler[UptimePacketValue, CheckStatus]):
    @override
    @property
    def thresholds(self) -> DetectorThresholds:
        recovery_threshold = self.detector.config["recovery_threshold"]
        downtime_threshold = self.detector.config["downtime_threshold"]

        return {
            DetectorPriorityLevel.OK: recovery_threshold,
            DetectorPriorityLevel.HIGH: downtime_threshold,
        }

    @override
    def extract_value(self, data_packet: DataPacket[UptimePacketValue]) -> CheckStatus:
        return data_packet.packet.check_result["status"]

    @override
    def build_issue_fingerprint(self, group_key: DetectorGroupKey = None) -> list[str]:
        # TODO(epurkhiser): We should migrate the fingerprints over to match
        # what the default fingerprint is.
        return build_fingerprint(self.detector)

    @override
    def extract_dedupe_value(self, data_packet: DataPacket[UptimePacketValue]) -> int:
        return int(data_packet.packet.check_result["scheduled_check_time_ms"])

    @override
    def evaluate(
        self, data_packet: DataPacket[UptimePacketValue]
    ) -> dict[DetectorGroupKey, DetectorEvaluationResult]:
        result = super().evaluate(data_packet)

        if not result:
            return result

        # Uptime does not use stateful detector value grouping
        evaluation = result[None]

        uptime_subscription = data_packet.packet.subscription
        metric_tags = data_packet.packet.metric_tags

        issue_creation_enabled = options.get("uptime.create-issues")
        restricted_host_provider_ids = options.get(
            "uptime.restrict-issue-creation-by-hosting-provider-id"
        )
        host_provider_id = uptime_subscription.host_provider_id
        host_provider_enabled = host_provider_id not in restricted_host_provider_ids

        issue_creation_allowed = issue_creation_enabled and host_provider_enabled

        if not host_provider_enabled:
            metrics.incr(
                "uptime.result_processor.restricted_by_provider",
                sample_rate=1.0,
                tags={
                    "host_provider_id": host_provider_id,
                    **metric_tags,
                },
            )

        result_creates_issue = isinstance(evaluation.result, IssueOccurrence)
        result_resolves_issue = isinstance(evaluation.result, StatusChangeMessage)

        if result_creates_issue:
            metrics.incr(
                "uptime.detector.will_create_issue",
                tags=metric_tags,
                sample_rate=1.0,
            )
            # XXX(epurkhiser): This logging includes the same extra arguments
            # as the `uptime_active_sent_occurrence` log in the consumer for
            # legacy creation
            logger.info(
                "uptime.detector.will_create_issue",
                extra={
                    "project_id": self.detector.project_id,
                    "url": uptime_subscription.url,
                    **data_packet.packet.check_result,
                },
            )
        if result_resolves_issue:
            metrics.incr(
                "uptime.detector.will_resolve_issue",
                sample_rate=1.0,
                tags=metric_tags,
            )
            logger.info(
                "uptime.detector.will_resolve_issue",
                extra={
                    "project_id": self.detector.project_id,
                    "url": uptime_subscription.url,
                    **data_packet.packet.check_result,
                },
            )

        # Reutning an empty dict effectively causes the detector processor to
        # bail and not produce an issue occurrence.
        if result_creates_issue and not issue_creation_allowed:
            return {}

        return result

    @override
    def create_occurrence(
        self,
        evaluation_result: ProcessedDataConditionGroup,
        data_packet: DataPacket[UptimePacketValue],
        priority: DetectorPriorityLevel,
    ) -> tuple[DetectorOccurrence, EventData]:
        result = data_packet.packet.check_result
        uptime_subscription = data_packet.packet.subscription

        occurrence = DetectorOccurrence(
            issue_title=f"Downtime detected for {uptime_subscription.url}",
            subtitle="Your monitored domain is down",
            evidence_display=build_evidence_display(result),
            type=UptimeDomainCheckFailure,
            level="error",
            culprit="",  # TODO: The url?
            assignee=self.detector.owner,
            priority=priority,
        )
        event_data = build_event_data(result, self.detector)

        return (occurrence, event_data)


@dataclass(frozen=True)
class UptimeDomainCheckFailure(GroupType):
    type_id = 7001
    slug = GROUP_TYPE_UPTIME_DOMAIN_CHECK_FAILURE
    description = "Uptime Domain Monitor Failure"
    released = True
    category = GroupCategory.UPTIME.value
    category_v2 = GroupCategory.OUTAGE.value
    creation_quota = Quota(3600, 60, 1000)  # 1000 per hour, sliding window of 60 seconds
    default_priority = PriorityLevel.HIGH
    enable_auto_resolve = False
    enable_escalation_detection = False
    detector_settings = DetectorSettings(
        handler=UptimeDetectorHandler,
        validator=UptimeDomainCheckFailureValidator,
        config_schema={
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "description": "A representation of an uptime alert",
            "type": "object",
            "required": ["mode", "environment", "recovery_threshold", "downtime_threshold"],
            "properties": {
                "mode": {
                    "type": ["integer"],
                    "enum": [mode.value for mode in UptimeMonitorMode],
                },
                "environment": {"type": ["string", "null"]},
                "recovery_threshold": {
                    "type": "integer",
                    "minimum": 1,
                    "description": "Number of consecutive successful checks required to mark monitor as recovered",
                },
                "downtime_threshold": {
                    "type": "integer",
                    "minimum": 1,
                    "description": "Number of consecutive failed checks required to mark monitor as down",
                },
            },
            "additionalProperties": False,
        },
        filter=~Q(config__mode=UptimeMonitorMode.AUTO_DETECTED_ONBOARDING),
    )
