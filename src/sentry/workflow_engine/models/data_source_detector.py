from django.db import models, router, transaction
from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model
from sentry.workflow_engine.caches.detector import invalidate_detectors_by_data_source_cache


@region_silo_model
class DataSourceDetector(DefaultFieldsModel):
    """
    Lookup table that maps a DataSource to a Detector. This is used to determine which detectors are available for a given data source.
    """

    __relocation_scope__ = RelocationScope.Organization

    data_source = FlexibleForeignKey("workflow_engine.DataSource")
    detector = FlexibleForeignKey("workflow_engine.Detector")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["data_source", "detector"],
                name="workflow_engine_uniq_datasource_detector",
            )
        ]


def _schedule_cache_invalidation(instance: DataSourceDetector) -> None:
    """Schedule cache invalidation to run after transaction commits."""

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
