from collections.abc import Callable
from typing import Any

from sentry.rules.conditions.every_event import EveryEventCondition
from sentry.utils.registry import Registry
from sentry.workflow_engine.models.data_condition import Condition, DataCondition
from sentry.workflow_engine.models.data_condition_group import DataConditionGroup

data_condition_translator_registry = Registry[
    Callable[[dict[str, Any], DataConditionGroup], DataCondition]
]()


def translate_to_data_condition(data: dict[str, Any], dcg: DataConditionGroup):
    translator = data_condition_translator_registry.get(data["id"])
    return translator(data, dcg)


@data_condition_translator_registry.register(EveryEventCondition.id)
def create_every_event_condition(data: dict[str, Any], dcg: DataConditionGroup) -> DataCondition:
    return DataCondition.objects.create(
        condition=Condition.TRUTH,
        comparison=True,
        condition_result=True,
        condition_group=dcg,
    )
