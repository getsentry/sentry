from sentry.workflow_engine.handlers.detector.base import DetectorHandler
from sentry.workflow_engine.models.data_source import DataPacket
from sentry.workflow_engine.types import (
    DetectorEvaluationResult,
    DetectorGroupKey,
    DetectorSettings,
    DetectorType,
    detector_settings_registry,
)


class IssueStreamDetectorHandler(DetectorHandler[object]):
    """Placeholder handler for the issue stream detector."""

    def evaluate(
        self, data_packet: DataPacket[object]
    ) -> dict[DetectorGroupKey, DetectorEvaluationResult]:
        return {}


detector_settings_registry.register(
    DetectorType.ISSUE_STREAM,
    DetectorSettings(
        handler=IssueStreamDetectorHandler,
        validator=None,
        config_schema={"type": "object", "additionalProperties": False},
    ),
)
