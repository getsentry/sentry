from typing import Any

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from sentry.workflow_engine.caches.workflow import invalidate_processing_workflows
from sentry.workflow_engine.models import Detector


@receiver(post_save, sender=Detector)
def invalidate_processing_workflows_cache(
    sender: type[Detector], instance: Detector, **kwargs
) -> None:
    # If this is a _new_ detector, we can early exit.
    # There will be no associations or caches using this model yet.
    if kwargs.get("created") or not instance.id:
        return

    invalidate_processing_workflows(instance.id)


@receiver(pre_save, sender=Detector)
def enforce_config_schema_signal(sender: type[Detector], instance: Detector, **kwargs: Any) -> None:
    """
    This needs to be a signal because the grouptype registry's entries are not available at import time.
    """
    instance.enforce_config_schema()
