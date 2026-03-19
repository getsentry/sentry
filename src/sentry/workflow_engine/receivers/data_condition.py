from typing import Any

from django.db import router, transaction
from django.db.models.signals import post_save, pre_delete, pre_save
from django.dispatch import receiver

from sentry.workflow_engine.caches.action_filters import (
    invalidate_action_filter_cache_by_workflow_ids,
)
from sentry.workflow_engine.models import WorkflowDataConditionGroup
from sentry.workflow_engine.models.data_condition import (
    DataCondition,
    enforce_data_condition_json_schema,
)
from sentry.workflow_engine.types import WorkflowId


@receiver(pre_save, sender=DataCondition)
def enforce_comparison_schema(
    sender: type[DataCondition],
    instance: DataCondition,
    **kwargs: Any,
) -> None:
    enforce_data_condition_json_schema(instance)


@receiver(pre_delete, sender=DataCondition)
@receiver(post_save, sender=DataCondition)
def invlidate_action_filter_cache_by_data_condition(
    sender: type[DataCondition],
    instance: DataCondition,
    **kwargs: Any,
) -> None:
    workflow_ids: list[WorkflowId] | None = None

    try:
        # TODO -- see if we can determine if the DataCondition is
        # an ActionFilter, to skip querying for the workflow.
        workflow_ids = WorkflowDataConditionGroup.objects.filter(
            condition_group__conditions__id=instance.id
        ).values_list("workflow_id", flat=True)
    except WorkflowDataConditionGroup.DoesNotExist:
        pass

    if workflow_ids:
        # ensure the execution is after the transaction is committed
        def execute_invalidation() -> None:
            invalidate_action_filter_cache_by_workflow_ids(workflow_ids)

        transaction.on_commit(
            execute_invalidation,
            router.db_for_write(DataCondition),
        )
