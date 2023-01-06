from django.db import IntegrityError, models, transaction
from django.utils import timezone

from sentry.db.models import (
    BoundedBigIntegerField,
    Model,
    control_silo_only_model,
    region_silo_only_model,
)


class TombstoneBase(Model):
    class Meta:
        abstract = True
        unique_together = ("table_name", "object_identifier")

    __include_in_export__ = False

    table_name = models.CharField(max_length=48, null=False)
    object_identifier = BoundedBigIntegerField(null=False)
    created_at = models.DateTimeField(null=False, default=timezone.now)

    @classmethod
    def record_delete(cls, table_name: str, identifier: int):
        try:
            with transaction.atomic():
                cls.objects.create(table_name=table_name, object_identifier=identifier)
        except IntegrityError:
            pass


@region_silo_only_model
class RegionTombstone(TombstoneBase):
    class Meta:
        app_label = "sentry"
        db_table = "sentry_regiontombstone"


@control_silo_only_model
class ControlTombstone(TombstoneBase):
    class Meta:
        app_label = "sentry"
        db_table = "sentry_controltombstone"
