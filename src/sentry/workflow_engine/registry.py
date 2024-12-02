from collections.abc import Callable
from typing import Any, Generic, TypeVar, cast

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, region_silo_model
from sentry.utils.registry import Registry
from sentry.workflow_engine.types import ConditionHandler, DataSourceTypeHandler

data_source_type_registry = Registry[type[DataSourceTypeHandler]]()
condition_handler_registry = Registry[ConditionHandler[Any]]()

# IT WORKS! Migrate this to the condition_handler

T = TypeVar("T")
Handler = Callable[[T, Any, str], bool]
handler_registry = Registry[Handler[Any]]()


@region_silo_model
class DataHandler(Generic[T], DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Excluded

    condition = models.CharField(max_length=200)
    comparison = models.JSONField()
    type = models.CharField(max_length=200)
    condition_group = models.ForeignKey(
        "workflow_engine.DataConditionGroup",
        related_name="conditions",
        on_delete=models.CASCADE,
    )

    def evaluate_value(self, data: T, value: Any, operator: str) -> bool:
        handler = cast(Handler[T], handler_registry.get("Test1"))
        return handler(data, value, operator)


@handler_registry.register("Test1")
def test1_handler(data: T, value: Any, operator: str) -> bool:
    return data == value


def execute_test():
    condition = DataHandler[str]()
    result1 = condition.evaluate_value(1, 1, "")
    result2 = condition.evaluate_value("test", "test", "")

    print("result1:", result1)
    print("result2:", result2)
