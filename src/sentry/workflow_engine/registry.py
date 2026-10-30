from __future__ import annotations

from collections.abc import Callable
from typing import TYPE_CHECKING, Any

from sentry import features
from sentry.utils.registry import Registry
from sentry.workflow_engine.types import (
    ActionHandler,
    DataConditionHandler,
    DataSourceTypeHandler,
    DetectorSettings,
    DetectorType,
    WorkflowActivityHandler,
)

if TYPE_CHECKING:
    from sentry.models.organization import Organization

data_source_type_registry = Registry[type[DataSourceTypeHandler[Any]]]()
condition_handler_registry = Registry[type[DataConditionHandler[Any]]](enable_reverse_lookup=False)
action_handler_registry = Registry[type[ActionHandler]](enable_reverse_lookup=False)
workflow_activity_registry = Registry[WorkflowActivityHandler](enable_reverse_lookup=False)


class DetectorSettingsRegistry(Registry[type[DetectorSettings]]):
    def register(self, key: str) -> Callable[[type[DetectorSettings]], type[DetectorSettings]]:
        if not isinstance(key, DetectorType):
            raise ValueError("Detector settings must be registered with a DetectorType member")
        return super().register(key)


detector_settings_registry = DetectorSettingsRegistry(enable_reverse_lookup=False)


def get_visible_detector_types(organization: Organization) -> list[str]:
    """Resolve type discovery visibility independently of issue-type release controls."""
    visible_types = []
    for detector_type, settings in detector_settings_registry.registrations.items():
        gate = settings.type_visibility
        if gate is True or (not isinstance(gate, bool) and features.has(gate.name, organization)):
            visible_types.append(detector_type)
    return visible_types
