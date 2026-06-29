from typing import Any

from sentry.utils.registry import Registry
from sentry.workflow_engine.types import (
    ActionHandler,
    DataConditionHandler,
    DataSourceTypeHandler,
    WorkflowActivityHandler,
)

data_source_type_registry = Registry[type[DataSourceTypeHandler[Any]]]()
condition_handler_registry = Registry[type[DataConditionHandler[Any]]](enable_reverse_lookup=False)
action_handler_registry = Registry[type[ActionHandler]](enable_reverse_lookup=False)
workflow_activity_registry = Registry[WorkflowActivityHandler](enable_reverse_lookup=False)
