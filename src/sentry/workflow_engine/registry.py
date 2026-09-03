from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sentry.utils.registry import Registry
from sentry.workflow_engine.types import (
    ActionHandler,
    DataConditionHandler,
    DataSourceTypeHandler,
    WorkflowActivityHandler,
)

if TYPE_CHECKING:
    from sentry.workflow_engine.endpoints.validators.base import BaseDetectorTypeValidator
    from sentry.workflow_engine.handlers.detector import DetectorHandler

data_source_type_registry = Registry[type[DataSourceTypeHandler[Any]]]()
condition_handler_registry = Registry[type[DataConditionHandler[Any]]](enable_reverse_lookup=False)
action_handler_registry = Registry[type[ActionHandler]](enable_reverse_lookup=False)
workflow_activity_registry = Registry[WorkflowActivityHandler](enable_reverse_lookup=False)

detector_handler_registry: Registry[type[DetectorHandler[Any]]] = Registry(
    enable_reverse_lookup=False
)
detector_validator_registry: Registry[type[BaseDetectorTypeValidator]] = Registry(
    enable_reverse_lookup=False
)
