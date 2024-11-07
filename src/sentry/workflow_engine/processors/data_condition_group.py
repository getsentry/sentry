from sentry.utils.function_cache import cache_func_for_models
from sentry.workflow_engine.models import DataCondition, DataConditionGroup


@cache_func_for_models(
    [
        (DataConditionGroup, lambda group: (group.id,)),
        (DataCondition, lambda condition: (condition.condition_group_id,)),
    ],
    # There shouldn't be stampedes to fetch this data, and we might update multiple `DataConditionGroup`s at the same
    # time, so we'd prefer to avoid re-fetching this many times. Just bust the cache and re-fetch lazily.
    recalculate=False,
)
def get_data_group_conditions_and_group(
    data_condition_group_id: int,
) -> tuple[DataConditionGroup | None, list[DataCondition]]:
    try:
        group = DataConditionGroup.objects.get(id=data_condition_group_id)
        conditions = list(group.conditions.all())
    except DataConditionGroup.DoesNotExist:
        group = None
        conditions = []
    return group, conditions


# TODO - flatten this more from the evaluate method in group
def process_data_condition_group(
    data_condition_group_id: int, value
) -> tuple[bool, list[DataCondition]]:
    group, conditions = get_data_group_conditions_and_group(data_condition_group_id)

    if group is None:
        return False, []

    return group.evaluate(value, conditions)
