from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any, TypeAlias

from django.utils import timezone
from rest_framework import serializers

from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.snuba.snuba_query_validator import SnubaQueryValidator
from sentry.workflow_engine.endpoints.validators.base import BaseDetectorTypeValidator
from sentry.workflow_engine.handlers.detector.base import (
    DetectorHandler,
    DetectorOccurrence,
    GroupedDetectorEvaluationResult,
)
from sentry.workflow_engine.models import DataPacket
from sentry.workflow_engine.processors.data_condition_group import ProcessedDataConditionGroup
from sentry.workflow_engine.types import DetectorEvaluationResult, DetectorPriorityLevel

PacketT = dict[str, int]
EvaluationT: TypeAlias = None


# As a DetectorEvaluationResult but fewer optional fields
@dataclass(frozen=True)
class PreprodEvaluationResult:
    priority: DetectorPriorityLevel
    occurrence: IssueOccurrence
    event_data: dict[str, Any]

    def to_detector_evaluation_result(self) -> DetectorEvaluationResult:
        return DetectorEvaluationResult(
            group_key=None,
            # TODO: check is_triggered should be False
            is_triggered=False,
            priority=self.priority,
            event_data=self.event_data,
            result=self.occurrence,
        )


class PreprodStaticDetectorHandler(DetectorHandler[PacketT, EvaluationT]):
    def evaluate_impl(self, data_packet: DataPacket[PacketT]) -> GroupedDetectorEvaluationResult:
        evaluation = self._evaluate_impl_impl(data_packet)
        result = {}
        if evaluation is not None:
            detector_evaluation = evaluation.to_detector_evaluation_result()
            result[detector_evaluation.group_key] = detector_evaluation
        return GroupedDetectorEvaluationResult(result=result, tainted=False)

    def _evaluate_impl_impl(
        self, data_packet: DataPacket[PacketT]
    ) -> PreprodEvaluationResult | None:
        from sentry.preprod.grouptype import PreprodStaticGroupType

        occurrence_id = uuid.uuid4().hex
        occurrence = IssueOccurrence(
            id=occurrence_id,
            project_id=self.detector.project_id,
            event_id=occurrence_id,
            fingerprint=["preprod-static-test"],
            issue_title="Preprod Static Issue",
            subtitle="A preprod static analysis issue was detected",
            resource_id=None,
            evidence_data={},
            evidence_display=[
                IssueEvidence(
                    name="Source",
                    value=data_packet.source_id,
                    important=True,
                )
            ],
            type=PreprodStaticGroupType,
            detection_time=timezone.now(),
            level="warning",
            culprit=None,
        )
        return PreprodEvaluationResult(
            priority=DetectorPriorityLevel.HIGH,
            occurrence=occurrence,
            event_data={},
        )

    def extract_value(self, data_packet: DataPacket[PacketT]) -> EvaluationT:
        # While required by the interface nothing calls this except
        # for StatefulDetectorHandler.
        raise NotImplementedError

    def extract_dedupe_value(self, data_packet: DataPacket[PacketT]) -> int:
        # While required by the interface nothing calls this except
        # for StatefulDetectorHandler.
        raise NotImplementedError

    def create_occurrence(
        self,
        evaluation_result: ProcessedDataConditionGroup,
        data_packet: DataPacket[PacketT],
        priority: DetectorPriorityLevel,
    ) -> tuple[DetectorOccurrence, dict[str, Any]]:
        # While required by the interface nothing calls this except
        # for StatefulDetectorHandler.
        raise NotImplementedError


class PreprodStaticDetectorValidator(BaseDetectorTypeValidator):
    data_sources = serializers.ListField(
        child=SnubaQueryValidator(timeWindowSeconds=True), required=False
    )
