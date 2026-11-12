from collections.abc import Callable
from typing import Any

from sentry.utils.registry import Registry
from sentry.workflow_engine.types import (
    ActionHandler,
    DataConditionHandler,
    DataSourceTypeHandler,
    DetectorSettings,
    DetectorType,
    WorkflowActivityHandler,
)

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
