from typing import Any

from django.db import router, transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from sentry.workflow_engine.caches.action_filters import (
    invalidate_action_filter_cache_by_workflow_ids,
)
from sentry.workflow_engine.models import DataConditionGroup
from sentry.workflow_engine.models.workflow_data_condition_group import WorkflowDataConditionGroup
from sentry.workflow_engine.types import WorkflowId


@receiver(post_save, sender=DataConditionGroup)
def invalidate_action_filters_cache_by_condition_group(
    sender: type[DataConditionGroup],
    instance: DataConditionGroup,
    **kwargs: Any,
) -> None:
    """
    This handler only needs to invalidate the cache if the
    DataConditionGroup is updating. If there is a new condition group
    added, there will also be WorkflowDataConditionGroup's added / created.
    Relying on those receivers will reduce the querying required to maintain
    the cache.
    """
    if kwargs.get("created"):
        return

    # TODO -- see if we can determine if the DataConditionGroup is
    # an ActionFilter, to skip querying for the workflow.
    workflow_ids: list[WorkflowId] = list(
        WorkflowDataConditionGroup.objects.filter(
            condition_group_id=instance.id,
        ).values_list(
            "workflow_id",
            flat=True,
        )
    )

    if workflow_ids:
        # ensure the execution is after the transaction is committed
        def execute_invalidation() -> None:
            invalidate_action_filter_cache_by_workflow_ids(workflow_ids)

        transaction.on_commit(
            execute_invalidation,
            router.db_for_write(
                DataConditionGroup,
            ),
        )
