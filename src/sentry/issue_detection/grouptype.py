from __future__ import annotations

from types import MappingProxyType

from sentry.issues.grouptype import PerformanceNPlusOneGroupType
from sentry.workflow_engine.registry import detector_settings_registry
from sentry.workflow_engine.types import DetectorAPIOperation, DetectorSettings, DetectorType

__all__ = ["PerformanceNPlusOneGroupType"]


@detector_settings_registry.register(DetectorType.PERFORMANCE_SLOW_DB_QUERY)
@detector_settings_registry.register(DetectorType.PERFORMANCE_LARGE_HTTP_PAYLOAD)
@detector_settings_registry.register(DetectorType.QUERY_INJECTION_VULNERABILITY)
class PerformanceDetectorSettings(DetectorSettings):
    # Execution and configuration validation remain in the legacy performance pipeline.
    config_schema = None
    # Preserve row access and bulk updates. Missing validators and system-detector permissions
    # continue to reject creation, detail edits, and deletion through their existing paths.
    api_availability = MappingProxyType(
        {
            DetectorAPIOperation.LIST: True,
            DetectorAPIOperation.GET: True,
            DetectorAPIOperation.PUT: True,
            DetectorAPIOperation.POST: True,
            DetectorAPIOperation.DELETE: True,
        }
    )
