from collections.abc import Callable
from typing import Any

from sentry.rules.conditions.every_event import EveryEventCondition
from sentry.rules.conditions.reappeared_event import ReappearedEventCondition
from sentry.rules.conditions.regression_event import RegressionEventCondition
from sentry.utils.registry import Registry
from sentry.workflow_engine.models.data_condition import Condition, DataCondition
from sentry.workflow_engine.models.data_condition_group import DataConditionGroup

data_condition_translator_registry = Registry[
    Callable[[dict[str, Any], DataConditionGroup], DataCondition]
]()


def translate_to_data_condition(data: dict[str, Any], dcg: DataConditionGroup):
    translator = data_condition_translator_registry.get(data["id"])
    return translator(data, dcg)


@data_condition_translator_registry.register(ReappearedEventCondition.id)
def create_reappeared_event_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataCondition:
    return DataCondition.objects.create(
        type=Condition.REAPPEARED_EVENT,
        comparison=True,
        condition_result=True,
        condition_group=dcg,
    )


@data_condition_translator_registry.register(RegressionEventCondition.id)
def create_regressed_event_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataCondition:
    return DataCondition.objects.create(
        type=Condition.REGRESSION_EVENT,
        comparison=True,
        condition_result=True,
        condition_group=dcg,
    )


@data_condition_translator_registry.register(EveryEventCondition.id)
def create_every_event_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataCondition:
    return DataCondition.objects.create(
        type=Condition.EVERY_EVENT,
        comparison=True,
        condition_result=True,
        condition_group=dcg,
    )
