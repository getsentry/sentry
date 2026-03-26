from typing import Any

from django.db import router, transaction
from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver

from sentry.workflow_engine.caches.action_filters import (
    invalidate_action_filter_cache_by_workflow_ids,
)
from sentry.workflow_engine.models import WorkflowDataConditionGroup


@receiver(pre_delete, sender=WorkflowDataConditionGroup)
@receiver(post_save, sender=WorkflowDataConditionGroup)
def invalidate_action_filters(
    sender: type[WorkflowDataConditionGroup],
    instance: WorkflowDataConditionGroup,
    **kwargs: Any,
) -> None:
    """
    When we delete or update a WorkflowDataConditionGroup,
    the workflow needs to be cleared from the cache.

    If the relationship to the workflow changes, then we need to invalidate the cache.
    """

    def execute_invalidation() -> None:
        invalidate_action_filter_cache_by_workflow_ids([instance.workflow_id])

    transaction.on_commit(execute_invalidation, router.db_for_write(WorkflowDataConditionGroup))
