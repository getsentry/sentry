from django.db.models.signals import post_migrate, pre_delete, pre_save
from django.dispatch import receiver

from sentry.workflow_engine.caches.workflow import invalidate_processing_workflows
from sentry.workflow_engine.models import DetectorWorkflow


@receiver(post_migrate, sender=DetectorWorkflow)
def invalidate_all_processing_cache(sender, **kwargs) -> None:
    invalidate_processing_workflows(None, None)


@receiver(pre_save, sender=DetectorWorkflow)
def invalidate_processing_workflows_cache_pre(sender, instance: DetectorWorkflow, **kwargs) -> None:
    """
    Clear cache for BOTH old and new relationships when a DetectorWorkflow changes.

    - On create: Clears cache for the new relationship
    - On update: Clears cache for both old and new relationships
    """

    # If updating an existing instance, clear the old relationship cache
    if instance.pk is not None:
        try:
            # This lookup trade-off is okay, because we rarely update these relationships
            # Most cases are delete / create new DetectorWorkflow relationships.
            old_instance = DetectorWorkflow.objects.get(pk=instance.pk)
            invalidate_processing_workflows(
                old_instance.detector_id, old_instance.workflow.environment_id
            )
        except DetectorWorkflow.DoesNotExist:
            pass

    # Always clear the new relationship cache
    invalidate_processing_workflows(instance.detector_id, instance.workflow.environment_id)


@receiver(pre_delete, sender=DetectorWorkflow)
def invalidate_processing_workflows_cache_delete_relationship(
    sender, instance: DetectorWorkflow, **kwargs
) -> None:
    """
    Clear cache when a DetectorWorkflow is deleted to ensure the workflow
    is no longer evaluated for this detector.
    """
    invalidate_processing_workflows(instance.detector_id, instance.workflow.environment_id)
