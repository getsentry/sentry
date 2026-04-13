from sentry.grouping.grouptype import ErrorDetectorHandler
from sentry.workflow_engine.endpoints.validators.error_detector import ErrorDetectorValidator
from sentry.workflow_engine.types import DetectorSettings, DetectorType, detector_settings_registry

detector_settings_registry.register(
    DetectorType.ERROR,
    DetectorSettings(
        handler=ErrorDetectorHandler,
        validator=ErrorDetectorValidator,
        config_schema={"type": "object", "additionalProperties": False},
    ),
)
