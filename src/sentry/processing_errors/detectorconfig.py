from sentry.processing_errors.grouptype import SourcemapDetectorHandler
from sentry.workflow_engine.types import DetectorSettings, DetectorType, detector_settings_registry

detector_settings_registry.register(
    DetectorType.SOURCEMAP_CONFIGURATION,
    DetectorSettings(
        handler=SourcemapDetectorHandler,
        validator=None,
        config_schema={},
    ),
)
