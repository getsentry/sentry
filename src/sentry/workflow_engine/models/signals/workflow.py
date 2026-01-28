from django.db.models.signals import post_migrate, post_save, pre_delete, pre_save
from django.dispatch import receiver

from sentry.workflow_engine.caches.workflow import invalidate_processing_workflows
from sentry.workflow_engine.models import Detector, Workflow


@receiver(post_migrate, sender=Workflow)
def invalidate_all_processing_cache(sender, workflow: Workflow) -> None:
    pass


@receiver(pre_delete, sender=Workflow)
@receiver(pre_save, sender=Workflow)
@receiver(post_save, sender=Workflow)
def invalidate_processing_cache(sender, workflow: Workflow) -> None:
    """
    Invalidate the cache of workflows for processing when a workflow: changes, is removed, or is migrated.
    """
    # get the list of associated detectors that need the caches cleared
    detectors = Detector.objects.filter(detectorworkflow_workflow=workflow)

    # env is the related environment(s)?
    for detector in detectors:
        invalidate_processing_workflows(detector.id, workflow.environment_id)
