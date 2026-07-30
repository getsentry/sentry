from typing import Any

from django.db import router, transaction
from django.db.models.signals import post_save, pre_delete, pre_save
from django.dispatch import receiver

from sentry.utils.cache import cache
from sentry.workflow_engine.caches.detector import invalidate_detectors_by_data_source_cache
from sentry.workflow_engine.caches.workflow import invalidate_processing_workflows
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.models.detector import get_all_projects_detector_cache_key


def _invalidate_all_projects_detector_cache(instance: Detector) -> None:
    if instance.project_id is None:
        organization_id = instance.config.get("organization_id")
        if organization_id is not None:
            cache_key = get_all_projects_detector_cache_key(organization_id)
            cache.delete(cache_key)


@receiver(post_save, sender=Detector)
def invalidate_processing_workflows_cache(
    sender: type[Detector], instance: Detector, **kwargs: Any
) -> None:
    # If this is a _new_ detector, we can early exit.
    # There will be no associations or caches using this model yet.
    if kwargs.get("created") or not instance.id:
        return

    invalidate_processing_workflows(instance.id)
    _invalidate_all_projects_detector_cache(instance)


@receiver(pre_save, sender=Detector)
def enforce_config_schema_signal(sender: type[Detector], instance: Detector, **kwargs: Any) -> None:
    """
    This needs to be a signal because the GroupType registry's entries are not available at import time.
    """
    instance.enforce_config_schema()


@receiver(post_save, sender=Detector)
@receiver(pre_delete, sender=Detector)
def invalidate_detector_cache(sender: type[Detector], instance: Detector, **kwargs: Any) -> None:
    if kwargs.get("created") or not instance.id:
        return

    _invalidate_all_projects_detector_cache(instance)

    data_sources = list(instance.data_sources.values_list("source_id", "type"))

    def invalidate_cache() -> None:
        for source_id, source_type in data_sources:
            invalidate_detectors_by_data_source_cache(source_id, source_type)

    transaction.on_commit(invalidate_cache, using=router.db_for_write(Detector))
