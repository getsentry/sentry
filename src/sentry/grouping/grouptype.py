from dataclasses import dataclass

from sentry.issues.grouptype import GroupCategory, GroupType
from sentry.models.group import DEFAULT_TYPE_ID
from sentry.types.group import PriorityLevel

# Imported so the validator registers itself for this group type.
from sentry.workflow_engine.endpoints.validators.error_detector import (
    ErrorDetectorValidator,  # noqa: F401
)
from sentry.workflow_engine.handlers.detector.base import DetectorHandler
from sentry.workflow_engine.models.data_source import DataPacket
from sentry.workflow_engine.processors import DetectorEvaluation
from sentry.workflow_engine.registry import (
    detector_config_schema_registry,
    detector_handler_registry,
)
from sentry.workflow_engine.types import GROUP_TYPE_ERROR, DetectorGroupKey


@dataclass(frozen=True)
class ErrorGroupType(GroupType):
    type_id = DEFAULT_TYPE_ID
    slug = GROUP_TYPE_ERROR
    description = "Error"
    category = GroupCategory.ERROR.value
    default_priority = PriorityLevel.MEDIUM
    released = True


detector_config_schema_registry.register(ErrorGroupType.slug)(
    {"type": "object", "additionalProperties": False}
)


@detector_handler_registry.register(ErrorGroupType.slug)
class ErrorDetectorHandler(DetectorHandler[object]):
    """Placeholder handler for error group types."""

    def evaluate(
        self, data_packet: DataPacket[object]
    ) -> dict[DetectorGroupKey, DetectorEvaluation]:
        return {}
