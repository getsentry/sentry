from django.db.models import Q

from sentry.uptime.endpoints.validators import UptimeDomainCheckFailureValidator
from sentry.uptime.grouptype import UptimeDetectorHandler
from sentry.uptime.types import UptimeMonitorMode
from sentry.workflow_engine.types import DetectorSettings, DetectorType, detector_settings_registry

detector_settings_registry.register(
    DetectorType.UPTIME_DOMAIN_CHECK_FAILURE,
    DetectorSettings(
        handler=UptimeDetectorHandler,
        validator=UptimeDomainCheckFailureValidator,
        config_schema={
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "description": "A representation of an uptime alert",
            "type": "object",
            "required": ["mode", "environment", "recovery_threshold", "downtime_threshold"],
            "properties": {
                "mode": {
                    "type": ["integer"],
                    "enum": [mode.value for mode in UptimeMonitorMode],
                },
                "environment": {"type": ["string", "null"]},
                "recovery_threshold": {
                    "type": "integer",
                    "minimum": 1,
                    "description": "Number of consecutive successful checks required to mark monitor as recovered",
                },
                "downtime_threshold": {
                    "type": "integer",
                    "minimum": 1,
                    "description": "Number of consecutive failed checks required to mark monitor as down",
                },
            },
            "additionalProperties": False,
        },
        filter=~Q(config__mode=UptimeMonitorMode.AUTO_DETECTED_ONBOARDING),
    ),
)
