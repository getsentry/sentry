from typing import TYPE_CHECKING

from django.db.models.signals import post_migrate, post_save, pre_delete
from django.dispatch import receiver

from sentry.workflow_engine.caches.workflow import invalidate_processing_workflows

if TYPE_CHECKING:
    from sentry.workflow_engine.models import DetectorWorkflow


@receiver(post_migrate, sender=DetectorWorkflow)
@receiver(pre_delete, sender=DetectorWorkflow)
@receiver(post_save, sender=DetectorWorkflow)
def invalidate_processing_workflows_cache(sender, instance: DetectorWorkflow) -> None:
    """
    Invalidate the cache of workflows in processing when the workflows connections to a detector are
    changed, removed, or migrated
    """
    invalidate_processing_workflows(instance.detector_id, instance.workflow.environment_id)
