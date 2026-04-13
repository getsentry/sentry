from sentry.monitors.validators import MonitorIncidentDetectorValidator
from sentry.workflow_engine.types import DetectorSettings, DetectorType, detector_settings_registry

detector_settings_registry.register(
    DetectorType.MONITOR_CHECK_IN_FAILURE,
    DetectorSettings(
        handler=None,
        validator=MonitorIncidentDetectorValidator,
        config_schema={},
    ),
)
