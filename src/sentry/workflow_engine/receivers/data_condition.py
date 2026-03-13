from typing import Any

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from sentry.workflow_engine.models.data_condition import (
    DataCondition,
    enforce_data_condition_json_schema,
)


@receiver(pre_save, sender=DataCondition)
def enforce_comparison_schema(
    sender: type[DataCondition], instance: DataCondition, **kwargs: Any
) -> None:
    enforce_data_condition_json_schema(instance)


@receiver(post_save, sender=DataCondition)
def invlidate_action_filter_cache(
    sender: type[DataCondition], instance: DataCondition, **kwargs: Any
) -> None:
    # TODO - when an action filter is updated, we need to invalidate
    # the related workflows cache. Can this simply check the instance
    # and see if the type of condition is an action filter?
    pass
