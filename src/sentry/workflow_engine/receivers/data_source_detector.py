from typing import Any

from django.db import router, transaction
from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver

from sentry.workflow_engine.caches.data_source import (
    invalidate_data_sources_by_detector_and_source_id_cache,
    invalidate_detector_has_data_sources_cache,
)
from sentry.workflow_engine.caches.detector import invalidate_detectors_by_data_source_cache
from sentry.workflow_engine.models.data_source_detector import DataSourceDetector


@receiver(post_save, sender=DataSourceDetector)
@receiver(pre_delete, sender=DataSourceDetector)
def invalidate_cache_on_data_source_detector(
    sender: type[DataSourceDetector], instance: DataSourceDetector, **kwargs: Any
) -> None:
    source_id = instance.data_source.source_id
    source_type = instance.data_source.type

    transaction.on_commit(
        lambda: invalidate_detectors_by_data_source_cache(source_id, source_type),
        using=router.db_for_write(DataSourceDetector),
    )


@receiver(post_save, sender=DataSourceDetector)
@receiver(pre_delete, sender=DataSourceDetector)
def invalidate_data_source_cache_on_data_source_detector(
    sender: type[DataSourceDetector], instance: DataSourceDetector, **kwargs: Any
) -> None:
    detector_id = instance.detector_id

    source_id = instance.data_source.source_id

    def invalidate_cache() -> None:
        invalidate_data_sources_by_detector_and_source_id_cache(detector_id, source_id)
        invalidate_detector_has_data_sources_cache(detector_id)

    transaction.on_commit(invalidate_cache, using=router.db_for_write(DataSourceDetector))
