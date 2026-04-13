from sentry.workflow_engine.endpoints.validators.error_detector import ErrorDetectorValidator
from sentry.workflow_engine.handlers.detector.base import DetectorHandler
from sentry.workflow_engine.models.data_source import DataPacket
from sentry.workflow_engine.types import (
    DetectorEvaluationResult,
    DetectorGroupKey,
    DetectorSettings,
    DetectorType,
    detector_settings_registry,
)


class ErrorDetectorHandler(DetectorHandler[object]):
    """Placeholder handler for error group types."""

    def evaluate(
        self, data_packet: DataPacket[object]
    ) -> dict[DetectorGroupKey, DetectorEvaluationResult]:
        return {}


detector_settings_registry.register(
    DetectorType.ERROR,
    DetectorSettings(
        handler=ErrorDetectorHandler,
        validator=ErrorDetectorValidator,
        config_schema={"type": "object", "additionalProperties": False},
    ),
)
