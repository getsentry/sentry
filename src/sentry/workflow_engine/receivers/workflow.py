from typing import Any

from django.db import router, transaction
from django.db.models.signals import post_save, pre_delete, pre_save
from django.dispatch import receiver

from sentry.workflow_engine.caches.workflow import invalidate_processing_workflows
from sentry.workflow_engine.models import Detector, Workflow


@receiver(pre_save, sender=Workflow)
def enforce_workflow_config_schema(
    sender: type[Workflow], instance: Workflow, **kwargs: Any
) -> None:
    instance.validate_config(instance.config_schema)


@receiver(pre_delete, sender=Workflow)
@receiver(post_save, sender=Workflow)
def invalidate_processing_cache(sender: type[Workflow], instance: Workflow, **kwargs: Any) -> None:
    """
    Invalidate the cache of workflows for processing when a workflow: changes, is removed, or is migrated.

    Uses transaction.on_commit to ensure invalidation happens after DB commit,
    preventing a race condition where another request could repopulate the cache
    with stale data before the transaction commits.
    """
    # If this is a _new_ workflow, we can early exit.
    # There will be no associations or caches using this model yet.
    if kwargs.get("created") or not instance.id:
        return

    detectors = list(Detector.objects.filter(detectorworkflow__workflow=instance))
    env_id = instance.environment_id

    def do_invalidation() -> None:
        for detector in detectors:
            invalidate_processing_workflows(detector.id, env_id)

    transaction.on_commit(do_invalidation, router.db_for_write(Workflow))
