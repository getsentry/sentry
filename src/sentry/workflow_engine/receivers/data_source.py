from typing import Any

from django.db import router, transaction
from django.db.models.signals import post_save, pre_delete, pre_save
from django.dispatch import receiver

from sentry.utils.registry import NoRegistrationExistsError
from sentry.workflow_engine.caches.detector import invalidate_detectors_by_data_source_cache
from sentry.workflow_engine.models import DataSource
from sentry.workflow_engine.registry import data_source_type_registry


@receiver(pre_save, sender=DataSource)
def ensure_type_handler_registered(
    sender: type[DataSource], instance: DataSource, **kwargs: Any
) -> None:
    """
    Ensure that the type of the data source is valid and registered in the data_source_type_registry
    """
    data_source_type = instance.type

    if not data_source_type:
        raise ValueError(f"No group type found with type {instance.type}")

    try:
        data_source_type_registry.get(data_source_type)
    except NoRegistrationExistsError:
        raise ValueError(f"No data source type found with type {data_source_type}")


@receiver(post_save, sender=DataSource)
@receiver(pre_delete, sender=DataSource)
def invalidate_detector_cache_on_data_source(
    sender: type[DataSource], instance: DataSource, **kwargs: Any
) -> None:
    # Skip cache invalidation for newly created DataSources - no cache entries exist yet
    if kwargs.get("created"):
        return

    source_id = instance.source_id
    source_type = instance.type

    def invalidate_cache() -> None:
        invalidate_detectors_by_data_source_cache(source_id, source_type)

    transaction.on_commit(invalidate_cache, using=router.db_for_write(DataSource))
