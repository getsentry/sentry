from typing import Any

from django.db import router, transaction
from django.db.models.signals import pre_delete, pre_save
from django.dispatch import receiver

from sentry.workflow_engine.caches.workflow import invalidate_processing_workflows
from sentry.workflow_engine.models import DetectorWorkflow


@receiver(pre_save, sender=DetectorWorkflow)
def invalidate_processing_workflows_cache_pre(
    sender: type[DetectorWorkflow], instance: DetectorWorkflow, **kwargs: Any
) -> None:
    """
    Clear cache for BOTH old and new relationships when a DetectorWorkflow changes.
    Uses transaction.on_commit to ensure invalidation happens after DB commit,
    preventing a race condition where another request could repopulate the cache
    with stale data before the transaction commits.

    - On create: Clears cache for the new relationship
    - On update: Clears cache for both old and new relationships
    """
    # Capture values needed for invalidation before any changes
    new_detector_id = instance.detector_id
    new_env_id = instance.workflow.environment_id

    # If updating an existing instance, also need to invalidate old relationship
    old_detector_id = None
    old_env_id = None
    if instance.pk is not None:
        try:
            # This lookup trade-off is okay, because we rarely update these relationships
            # Most cases are delete / create new DetectorWorkflow relationships.
            old_instance = DetectorWorkflow.objects.get(pk=instance.pk)
            old_detector_id = old_instance.detector_id
            old_env_id = old_instance.workflow.environment_id
        except DetectorWorkflow.DoesNotExist:
            pass

    def do_invalidation() -> None:
        if old_detector_id is not None:
            invalidate_processing_workflows(old_detector_id, old_env_id)
        invalidate_processing_workflows(new_detector_id, new_env_id)

    transaction.on_commit(do_invalidation, router.db_for_write(DetectorWorkflow))


@receiver(pre_delete, sender=DetectorWorkflow)
def invalidate_processing_workflows_cache_delete_relationship(
    sender: type[DetectorWorkflow], instance: DetectorWorkflow, **kwargs: Any
) -> None:
    """
    Clear cache when a DetectorWorkflow is deleted to ensure the workflow
    is no longer evaluated for this detector.
    Uses transaction.on_commit to ensure invalidation happens after DB commit.
    """
    detector_id = instance.detector_id
    env_id = instance.workflow.environment_id

    transaction.on_commit(
        lambda: invalidate_processing_workflows(detector_id, env_id),
        router.db_for_write(DetectorWorkflow),
    )
