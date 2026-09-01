from dataclasses import dataclass

from sentry.issues.grouptype import GroupCategory, GroupType
from sentry.models.group import DEFAULT_TYPE_ID
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.endpoints.validators.error_detector import ErrorDetectorValidator
from sentry.workflow_engine.handlers.detector.base import (
    BaseDetectorHandler,
    DetectorOccurrence,
    EventData,
    GroupedDetectorEvaluationResult,
)
from sentry.workflow_engine.models.data_source import DataPacket
from sentry.workflow_engine.processors import (
    DataConditionGroupEvaluation,
    DetectorEvaluation,
)
from sentry.workflow_engine.types import (
    DetectorGroupKey,
    DetectorPriorityLevel,
    DetectorSettings,
)


class ErrorDetectorHandler(BaseDetectorHandler[object, object, DataConditionGroupEvaluation]):
    """Placeholder handler for error group types."""

    def _evaluate(
        self, data_packet: DataPacket[object]
    ) -> dict[DetectorGroupKey, DetectorEvaluation]:
        return {}

    def evaluate(self, data_packet: DataPacket[object]) -> GroupedDetectorEvaluationResult:
        raise NotImplementedError

    def extract_value(self, data_packet: DataPacket[object]) -> object:
        raise NotImplementedError

    def evaluate_extracted_value(
        self, extracted_value: object
    ) -> tuple[DataConditionGroupEvaluation | None, DetectorPriorityLevel]:
        raise NotImplementedError

    def create_occurrence(
        self,
        evaluation: DataConditionGroupEvaluation,
        data_packet: DataPacket[object],
        priority: DetectorPriorityLevel,
    ) -> tuple[DetectorOccurrence, EventData]:
        raise NotImplementedError


@dataclass(frozen=True)
class ErrorGroupType(GroupType):
    type_id = DEFAULT_TYPE_ID
    slug = "error"
    description = "Error"
    category = GroupCategory.ERROR.value
    default_priority = PriorityLevel.MEDIUM
    released = True
    detector_settings = DetectorSettings(
        handler=ErrorDetectorHandler,
        validator=ErrorDetectorValidator,
        config_schema={"type": "object", "additionalProperties": False},
    )
