from django.db import router, transaction
from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver

from sentry.workflow_engine.caches.detector import invalidate_detectors_by_data_source_cache
from sentry.workflow_engine.models.data_source_detector import DataSourceDetector


def _schedule_cache_invalidation(instance: DataSourceDetector) -> None:
    source_id = instance.data_source.source_id
    source_type = instance.data_source.type

    transaction.on_commit(
        lambda: invalidate_detectors_by_data_source_cache(source_id, source_type),
        using=router.db_for_write(DataSourceDetector),
    )


@receiver(post_save, sender=DataSourceDetector)
def invalidate_cache_on_data_source_detector_save(sender, instance: DataSourceDetector, **kwargs):
    _schedule_cache_invalidation(instance)


@receiver(pre_delete, sender=DataSourceDetector)
def invalidate_cache_on_data_source_detector_delete(sender, instance: DataSourceDetector, **kwargs):
    _schedule_cache_invalidation(instance)
