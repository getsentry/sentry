from __future__ import annotations

import abc
import enum
import logging
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, ClassVar, override

from django.db import IntegrityError, router, transaction
from django.utils import timezone
from sentry_redis_tools.sliding_windows_rate_limiter import Quota

from sentry.issues.grouptype import GroupCategory, GroupType, NotificationConfig
from sentry.issues.issue_occurrence import IssueEvidence
from sentry.models.eventerror import EventErrorType
from sentry.types.group import PriorityLevel
from sentry.utils import metrics
from sentry.workflow_engine.handlers.detector.base import (
    DetectorOccurrence,
    EventData,
    GroupedDetectorEvaluationResult,
)
from sentry.workflow_engine.handlers.detector.stateful import (
    DetectorThresholds,
    StatefulDetectorHandler,
)
from sentry.workflow_engine.models import DataPacket, DetectorState
from sentry.workflow_engine.processors.data_condition_group import ProcessedDataConditionGroup
from sentry.workflow_engine.types import (
    DetectorEvaluationResult,
    DetectorGroupKey,
    DetectorPriorityLevel,
    DetectorSettings,
)

logger = logging.getLogger(__name__)


class ProcessingErrorCheckStatus(enum.IntEnum):
    """
    Generic pass/fail status used as the comparison value for detector conditions.
    These must match the values used in DataCondition.comparison when
    provisioning the detector.
    """

    SUCCESS = 0
    FAILURE = 1


@dataclass(frozen=True)
class ProcessingErrorPacketValue:
    """
    The data payload passed into processing error detectors via DataPacket.
    Represents the error event that triggered detection.
    """

    event_id: str
    event_data: Mapping[str, Any]


# Error types from symbolicator that indicate sourcemap configuration problems
JS_SOURCEMAP_ERROR_TYPES = frozenset(
    {
        EventErrorType.JS_MISSING_SOURCE,
        EventErrorType.JS_INVALID_SOURCEMAP,
        EventErrorType.JS_MISSING_SOURCES_CONTENT,
        EventErrorType.JS_SCRAPING_DISABLED,
        EventErrorType.JS_INVALID_SOURCEMAP_LOCATION,
    }
)


class ProcessingErrorDetectorHandler(
    StatefulDetectorHandler[ProcessingErrorPacketValue, ProcessingErrorCheckStatus],
    abc.ABC,
):
    """
    Base handler for processing error configuration issue detectors.

    Subclasses define class-level attributes to customize which error types
    to match, issue titles, fingerprints, and metrics. The group type is
    resolved at runtime from the detector's slug via the GroupType registry.
    """

    error_types: ClassVar[frozenset[str]]
    fingerprint_key: ClassVar[str]
    issue_title: ClassVar[str]
    issue_subtitle: ClassVar[str]

    @property
    def group_type(self) -> type[GroupType]:
        from sentry.issues.grouptype import registry

        gt = registry.get_by_slug(self.detector.type)
        assert gt is not None, f"No GroupType registered for slug {self.detector.type}"
        return gt

    @override
    @property
    def thresholds(self) -> DetectorThresholds:
        return {
            DetectorPriorityLevel.OK: 1,
            DetectorPriorityLevel.HIGH: 1,
        }

    @override
    def extract_value(
        self, data_packet: DataPacket[ProcessingErrorPacketValue]
    ) -> ProcessingErrorCheckStatus:
        errors = data_packet.packet.event_data.get("errors", [])
        has_errors = any(e.get("type") in self.error_types for e in errors)
        return (
            ProcessingErrorCheckStatus.FAILURE if has_errors else ProcessingErrorCheckStatus.SUCCESS
        )

    @override
    def extract_dedupe_value(self, data_packet: DataPacket[ProcessingErrorPacketValue]) -> int:
        # Not used — we override evaluate_impl and skip dedupe logic
        return 0

    @override
    def build_issue_fingerprint(self, group_key: DetectorGroupKey = None) -> list[str]:
        return [f"{self.detector.project_id}:{self.fingerprint_key}"]

    @override
    def create_occurrence(
        self,
        evaluation_result: ProcessedDataConditionGroup,
        data_packet: DataPacket[ProcessingErrorPacketValue],
        priority: DetectorPriorityLevel,
    ) -> tuple[DetectorOccurrence, EventData]:
        event_data_dict = data_packet.packet.event_data
        errors = event_data_dict.get("errors", [])
        matching_errors = [e for e in errors if e.get("type") in self.error_types]
        error_types = {e.get("type", "unknown") for e in matching_errors}

        evidence_data: dict[str, Any] = {
            "error_types": sorted(error_types),
            "sample_event_id": data_packet.packet.event_id,
        }

        evidence_display = [
            IssueEvidence(
                name="Error types",
                value=", ".join(sorted(error_types)),
                important=True,
            ),
        ]

        occurrence = DetectorOccurrence(
            issue_title=self.issue_title,
            subtitle=self.issue_subtitle,
            evidence_data=evidence_data,
            evidence_display=evidence_display,
            type=self.group_type,
            level="warning",
            culprit="",
            priority=priority,
        )

        event_data: EventData = {
            "platform": event_data_dict.get("platform", "other"),
            "sdk": event_data_dict.get("sdk"),
        }

        return (occurrence, event_data)

    @override
    def evaluate_impl(
        self, data_packet: DataPacket[ProcessingErrorPacketValue]
    ) -> GroupedDetectorEvaluationResult:
        """
        Custom evaluation that skips dedupe and threshold counting.
        Uses atomic DB updates for state transitions instead of the
        parent's batched state manager approach.
        """
        data_value = self.extract_value(data_packet)
        results: dict[DetectorGroupKey, DetectorEvaluationResult] = {}

        condition_results, evaluated_priority = self._evaluation_detector_conditions(data_value)

        if condition_results is None or condition_results.logic_result.triggered is False:
            return GroupedDetectorEvaluationResult(result=results, tainted=False)

        # Only handle triggering (FAILURE → HIGH). Resolution is handled
        # by a separate periodic task, not by the detector handler.
        if evaluated_priority != DetectorPriorityLevel.HIGH:
            return GroupedDetectorEvaluationResult(result=results, tainted=False)

        # Atomic state transition: use filter().update() as a lock.
        # If another process already triggered, rows_updated will be 0.
        rows_updated = self._try_state_transition(DetectorPriorityLevel.HIGH)

        if not rows_updated:
            metrics.incr(f"processing_errors.{self.detector.type}.state_transition_race")
            return GroupedDetectorEvaluationResult(result=results, tainted=False)

        results[None] = self._build_detector_evaluation_result(
            None,
            DetectorPriorityLevel.HIGH,
            condition_results,
            data_packet,
            data_value,
        )

        return GroupedDetectorEvaluationResult(result=results, tainted=False)

    def _try_state_transition(self, new_priority: DetectorPriorityLevel) -> int:
        """
        Attempt an atomic state transition on DetectorState.

        Uses filter().update() so that concurrent processes racing to make
        the same transition will see rows_updated=0 and bail out.
        """
        detector_states = self.state_manager.bulk_get_detector_state([None])
        detector_state = detector_states.get(None)

        if detector_state is None:
            try:
                with transaction.atomic(router.db_for_write(DetectorState)):
                    DetectorState.objects.create(
                        detector=self.detector,
                        detector_group_key=None,
                        is_triggered=True,
                        state=new_priority,
                    )
                return 1
            except IntegrityError:
                # Another process created the row first, just exit
                return 0

        return DetectorState.objects.filter(
            id=detector_state.id,
            is_triggered=False,
        ).update(
            is_triggered=True,
            state=new_priority,
            date_updated=timezone.now(),
        )


class SourcemapDetectorHandler(ProcessingErrorDetectorHandler):
    error_types = JS_SOURCEMAP_ERROR_TYPES
    fingerprint_key = "sourcemap"
    issue_title = "Broken source maps detected"
    issue_subtitle = "Source maps are not configured correctly for this project"


@dataclass(frozen=True)
class SourcemapConfigurationType(GroupType):
    type_id = 13001
    slug = "sourcemap_configuration"
    description = "Source Map Configuration Issue"
    category = GroupCategory.CONFIGURATION.value
    category_v2 = GroupCategory.CONFIGURATION.value
    released = False
    default_priority = PriorityLevel.LOW
    enable_auto_resolve = False
    enable_escalation_detection = False
    creation_quota = Quota(3600, 60, 100)
    notification_config = NotificationConfig(context=[])
    detector_settings = DetectorSettings(
        handler=SourcemapDetectorHandler,
        validator=None,
        config_schema={},
    )
    enable_user_status_and_priority_changes = False
    # For the moment, we only want to show these issue types in the ui
    enable_status_change_workflow_notifications = False
    enable_workflow_notifications = False
    # We want to show these separately to normal issue types
    in_default_search = False
