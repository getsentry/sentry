from django.db import router, transaction
from django.db.models.signals import post_save, pre_delete, pre_save
from django.dispatch import receiver

from sentry.workflow_engine.models.detector import Detector, enforce_config_schema


@receiver(pre_save, sender=Detector)
def enforce_config_schema_signal(sender, instance: Detector, **kwargs):
    """
    This needs to be a signal because the grouptype registry's entries are not available at import time.
    """
    enforce_config_schema(instance)


def _schedule_detector_cache_invalidation(instance: Detector) -> None:
    data_sources = list(instance.data_sources.values_list("source_id", "type"))

    def invalidate_cache():
        from sentry.workflow_engine.caches.detector import invalidate_detectors_by_data_source_cache

        for source_id, source_type in data_sources:
            invalidate_detectors_by_data_source_cache(source_id, source_type)

    transaction.on_commit(invalidate_cache, using=router.db_for_write(Detector))


@receiver(post_save, sender=Detector)
def invalidate_detector_cache_on_save(sender, instance: Detector, **kwargs):
    _schedule_detector_cache_invalidation(instance)


@receiver(pre_delete, sender=Detector)
def invalidate_detector_cache_on_delete(sender, instance: Detector, **kwargs):
    _schedule_detector_cache_invalidation(instance)
