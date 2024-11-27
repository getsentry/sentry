from sentry.utils.registry import Registry
from sentry.workflow_engine.types import ConditionHandler, DataSourceTypeHandler

data_source_type_registry = Registry[type[DataSourceTypeHandler]]()
condition_handler_registry = Registry[type[ConditionHandler]]()
