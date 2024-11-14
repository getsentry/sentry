from sentry.utils.registry import Registry
from sentry.workflow_engine.types import DataSourceTypeHandler

data_source_type_registry = Registry[type[DataSourceTypeHandler]]()
