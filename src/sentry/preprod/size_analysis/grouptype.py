from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from datetime import timezone as dt_timezone
from typing import Any, NotRequired, TypeAlias, TypedDict
from uuid import uuid4

from sentry.issues.grouptype import GroupCategory, GroupType
from sentry.issues.issue_occurrence import IssueEvidence
from sentry.types.group import PriorityLevel
from sentry.utils import metrics
from sentry.workflow_engine.endpoints.validators.base import BaseDetectorTypeValidator
from sentry.workflow_engine.handlers.detector.base import (
    BaseDetectorHandler,
    DetectorOccurrence,
    GroupedDetectorEvaluationResult,
)
from sentry.workflow_engine.models import DataPacket
from sentry.workflow_engine.processors.data_condition_group import (
    ProcessedDataConditionGroup,
    process_data_condition_group,
)
from sentry.workflow_engine.types import (
    DetectorEvaluationResult,
    DetectorPriorityLevel,
    DetectorSettings,
)

logger = logging.getLogger(__name__)


class SizeAnalysisValue(TypedDict):
    head_install_size_bytes: int
    head_download_size_bytes: int
    base_install_size_bytes: NotRequired[int | None]
    base_download_size_bytes: NotRequired[int | None]


SizeAnalysisDataPacket = DataPacket[SizeAnalysisValue]

# The value extracted from a data packet and evaluated against conditions.
# int for absolute values (bytes), float for relative diffs (ratios).
SizeAnalysisEvaluation: TypeAlias = int | float


class PreprodSizeAnalysisDetectorHandler(
    BaseDetectorHandler[SizeAnalysisValue, SizeAnalysisEvaluation]
):
    def evaluate_impl(self, data_packet: SizeAnalysisDataPacket) -> GroupedDetectorEvaluationResult:
        value = self.extract_value(data_packet)
        evaluation, priority = self._evaluate_conditions(value)
        if evaluation is None or priority is None:
            return GroupedDetectorEvaluationResult(result={}, tainted=False)

        detector_occurrence, event_data = self.create_occurrence(evaluation, data_packet, priority)
        occurrence = detector_occurrence.to_issue_occurrence(
            occurrence_id=event_data["event_id"],
            project_id=self.detector.project_id,
            status=priority,
            additional_evidence_data={},
            fingerprint=[uuid4().hex],
        )
        result = DetectorEvaluationResult(
            group_key=None,
            is_triggered=True,
            priority=priority,
            event_data=event_data,
            result=occurrence,
        )
        return GroupedDetectorEvaluationResult(result={None: result}, tainted=False)

    def _evaluate_conditions(
        self, value: SizeAnalysisEvaluation
    ) -> tuple[ProcessedDataConditionGroup | None, DetectorPriorityLevel | None]:
        if not self.condition_group:
            metrics.incr("workflow_engine.detector.skipping_invalid_condition_group")
            return None, None

        condition_evaluation, _ = process_data_condition_group(self.condition_group, value)
        if not condition_evaluation.logic_result.triggered:
            return None, None

        priorities = [
            condition_result.result
            for condition_result in condition_evaluation.condition_results
            if isinstance(condition_result.result, DetectorPriorityLevel)
        ]
        if not priorities:
            return None, None

        return condition_evaluation, max(priorities)

    def _extract_head(self, data_packet: SizeAnalysisDataPacket) -> int:
        measurement = self.detector.config["measurement"]
        match measurement:
            case "install_size":
                return data_packet.packet["head_install_size_bytes"]
            case "download_size":
                return data_packet.packet["head_download_size_bytes"]
            case _:
                raise ValueError(f"Unknown measurement: {measurement}")

    def _extract_base(self, data_packet: SizeAnalysisDataPacket) -> int:
        measurement = self.detector.config["measurement"]
        match measurement:
            case "install_size":
                base = data_packet.packet.get("base_install_size_bytes")
            case "download_size":
                base = data_packet.packet.get("base_download_size_bytes")
            case _:
                raise ValueError(f"Unknown measurement: {measurement}")
        if base is None:
            raise ValueError(f"Missing base value for measurement: {measurement}")
        return base

    def extract_value(self, data_packet: SizeAnalysisDataPacket) -> SizeAnalysisEvaluation:
        threshold_type = self.detector.config["threshold_type"]
        match threshold_type:
            case "absolute_threshold":
                return self._extract_head(data_packet)
            case "absolute_diff":
                return self._extract_head(data_packet) - self._extract_base(data_packet)
            case "relative_diff":
                base = self._extract_base(data_packet)
                return (self._extract_head(data_packet) - base) / base
            case _:
                raise ValueError(f"Unknown threshold_type: {threshold_type}")

    def create_occurrence(
        self,
        evaluation_result: ProcessedDataConditionGroup,
        data_packet: SizeAnalysisDataPacket,
        priority: DetectorPriorityLevel,
    ) -> tuple[DetectorOccurrence, dict[str, Any]]:
        current_timestamp = datetime.now(dt_timezone.utc)

        occurrence = DetectorOccurrence(
            issue_title="size",
            subtitle="A preprod static analysis issue was detected",
            evidence_display=[
                IssueEvidence(
                    name="Source",
                    value=data_packet.source_id,
                    important=True,
                )
            ],
            type=PreprodSizeAnalysisGroupType,
            level="warning",
            culprit="",
            priority=priority,
        )

        event_data = {
            "event_id": uuid4().hex,
            "project_id": self.detector.project_id,
            "platform": "android",
            "received": current_timestamp.timestamp(),
            "timestamp": current_timestamp.timestamp(),
            "tags": {},
        }

        return occurrence, event_data

    def extract_dedupe_value(self, data_packet: SizeAnalysisDataPacket) -> int:
        raise NotImplementedError


class PreprodSizeAnalysisDetectorValidator(BaseDetectorTypeValidator):
    pass


@dataclass(frozen=True)
class PreprodSizeAnalysisGroupType(GroupType):
    type_id = 11003
    slug = "preprod_size_analysis"
    description = "Size Analysis"
    category = GroupCategory.PREPROD.value
    category_v2 = GroupCategory.PREPROD.value
    default_priority = PriorityLevel.LOW
    released = False
    enable_auto_resolve = True
    enable_escalation_detection = False
    detector_settings = DetectorSettings(
        handler=PreprodSizeAnalysisDetectorHandler,
        validator=PreprodSizeAnalysisDetectorValidator,
        config_schema={
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "description": "Configuration for preprod static analysis detector",
            "type": "object",
            "properties": {
                "threshold_type": {
                    "type": "string",
                    "enum": ["absolute_diff", "absolute_threshold", "relative_diff"],
                    "description": "The type of threshold to apply",
                },
                "measurement": {
                    "type": "string",
                    "enum": ["install_size", "download_size"],
                    "description": "The measurement to track",
                },
            },
            "required": ["threshold_type", "measurement"],
            "additionalProperties": False,
        },
    )
