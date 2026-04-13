from sentry.preprod.size_analysis.grouptype import (
    PreprodSizeAnalysisDetectorHandler,
    PreprodSizeAnalysisDetectorValidator,
)
from sentry.workflow_engine.types import DetectorSettings, DetectorType, detector_settings_registry

detector_settings_registry.register(
    DetectorType.PREPROD_SIZE_ANALYSIS,
    DetectorSettings(
        handler=PreprodSizeAnalysisDetectorHandler,
        validator=PreprodSizeAnalysisDetectorValidator,
        config_schema={
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "description": "Configuration for preprod static analysis detector",
            "type": "object",
            "properties": {
                "threshold_type": {
                    "type": "string",
                    "enum": ["absolute_diff", "absolute", "relative_diff"],
                    "description": "The type of threshold to apply",
                },
                "measurement": {
                    "type": "string",
                    "enum": ["install_size", "download_size"],
                    "description": "The measurement to track",
                },
                "query": {
                    "type": "string",
                    "description": "Search query to filter which artifacts are monitored",
                },
            },
            "required": ["threshold_type", "measurement"],
            "additionalProperties": False,
        },
    ),
)
