from django.db.models.signals import post_migrate, post_save, pre_delete, pre_save
from django.dispatch import receiver

from sentry.workflow_engine.caches.workflow import invalidate_processing_workflows
from sentry.workflow_engine.models import Detector, Workflow


@receiver(pre_save, sender=Workflow)
def enforce_config_schema(sender, instance: Workflow, **kwargs) -> None:
    return instance.validate_config(instance.config_schema)


@receiver(post_migrate)
def invalidate_all_processing_cache(sender, **kwargs) -> None:
    # Invalidate cache for processing workflows after a migration
    invalidate_processing_workflows(None, None)


@receiver(pre_delete, sender=Workflow)
@receiver(post_save, sender=Workflow)
def invalidate_processing_cache(sender, instance: Workflow, **kwargs) -> None:
    """
    Invalidate the cache of workflows for processing when a workflow: changes, is removed, or is migrated.
    """
    # If this is a _new_ workflow, we can early exit.
    # There will be no associations or caches using this model yet.
    if kwargs.get("created") or not instance.id:
        return

    # get the list of associated detectors that need the caches cleared
    detectors = Detector.objects.filter(detectorworkflow__workflow=instance)

    for detector in detectors:
        invalidate_processing_workflows(detector.id, instance.environment_id)
