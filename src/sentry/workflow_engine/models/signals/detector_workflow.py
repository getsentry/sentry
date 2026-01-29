from typing import TYPE_CHECKING

from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver

from sentry.workflow_engine.caches.workflow import invalidate_processing_workflows

if TYPE_CHECKING:
    from sentry.workflow_engine.models import DetectorWorkflow


# @receiver(post_migrate, sender=DetectorWorkflow)
# TODO - handle post migrate?


@receiver(pre_delete, sender=DetectorWorkflow)
@receiver(post_save, sender=DetectorWorkflow)
def invalidate_processing_workflows_cache(sender, instance: DetectorWorkflow) -> None:
    """
    We need to invalidate the workflows being processed if the relationship between
    the detector and the workflow changes.

    The invalidation happens on:
    - pre_save: Ensures any previous relationship caches are cleared
    - post_save: Ensures the new relationships cache is cleared
    - pre_delete: Ensures if we disconnect a workflow, it's not evaluated
    """
    # TODO - update this method to work as described in the comment
    invalidate_processing_workflows(instance.detector_id, instance.workflow.environment_id)
