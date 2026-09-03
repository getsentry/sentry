from __future__ import annotations

from collections.abc import Callable
from typing import TYPE_CHECKING, Any

from django.db.models import Q

from sentry.utils.registry import Registry
from sentry.workflow_engine.types import (
    ActionHandler,
    DataConditionHandler,
    DataSourceTypeHandler,
    DetectorSettings,
    WorkflowActivityHandler,
)

# Prevent circular imports
if TYPE_CHECKING:
    from sentry.issues.grouptype import GroupType
    from sentry.workflow_engine.endpoints.validators.base import BaseDetectorTypeValidator
    from sentry.workflow_engine.handlers.detector import DetectorHandler

data_source_type_registry = Registry[type[DataSourceTypeHandler[Any]]]()
condition_handler_registry = Registry[type[DataConditionHandler[Any]]](enable_reverse_lookup=False)
action_handler_registry = Registry[type[ActionHandler]](enable_reverse_lookup=False)
workflow_activity_registry = Registry[WorkflowActivityHandler](enable_reverse_lookup=False)


class DetectorSettingsRegistry(Registry[DetectorSettings]):
    def register_group_type(
        self,
        *,
        handler: type[DetectorHandler[Any]] | None = None,
        validator: type[BaseDetectorTypeValidator] | None = None,
        config_schema: dict[str, Any] | None = None,
        filter: Q | None = None,
    ) -> Callable[[type[GroupType]], type[GroupType]]:
        detector_settings = DetectorSettings(
            handler=handler,
            validator=validator,
            config_schema=config_schema if config_schema is not None else {},
            filter=filter,
        )

        def register_settings(group_type: type[GroupType]) -> type[GroupType]:
            self.register(group_type.slug)(detector_settings)

            return group_type

        return register_settings


detector_settings_registry = DetectorSettingsRegistry(enable_reverse_lookup=False)
