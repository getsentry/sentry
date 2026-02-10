from typing import Any

from django.db import router, transaction
from django.db.models.signals import post_save, pre_delete, pre_save
from django.dispatch import receiver

from sentry.workflow_engine.models.detector import Detector, enforce_config_schema


@receiver(pre_save, sender=Detector)
def enforce_config_schema_signal(sender: type[Detector], instance: Detector, **kwargs: Any) -> None:
    """
    This needs to be a signal because the grouptype registry's entries are not available at import time.
    """
    enforce_config_schema(instance)


@receiver(post_save, sender=Detector)
@receiver(pre_delete, sender=Detector)
def invalidate_detector_cache(sender: type[Detector], instance: Detector, **kwargs: Any) -> None:
    data_sources = list(instance.data_sources.values_list("source_id", "type"))

    def invalidate_cache() -> None:
        from sentry.workflow_engine.caches.detector import invalidate_detectors_by_data_source_cache

        for source_id, source_type in data_sources:
            invalidate_detectors_by_data_source_cache(source_id, source_type)

    transaction.on_commit(invalidate_cache, using=router.db_for_write(Detector))
