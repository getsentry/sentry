from typing import Any

from sentry.utils.registry import Registry
from sentry.workflow_engine.types import ActionHandler, DataConditionHandler, DataSourceTypeHandler

data_source_type_registry = Registry[type[DataSourceTypeHandler]]()
condition_handler_registry = Registry[DataConditionHandler[Any]]()
action_handler_registry = Registry[ActionHandler]()
