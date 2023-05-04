from __future__ import annotations

from typing import Type

from django.db import IntegrityError, models, transaction
from django.utils import timezone

from sentry.db.models import (
    BoundedBigIntegerField,
    Model,
    control_silo_only_model,
    region_silo_only_model,
)
from sentry.silo import SiloMode


class TombstoneBase(Model):
    """
    Records a hard deletion so that the delete action can be propagated
    between regions. Subclasses provide specialized table names for each
    direction data needs to flow in.

    Tombstones are generally created by outbox receievers. Once
    created, tombstones are propagated between regions with RPC (coming soon)
    """

    class Meta:
        abstract = True
        unique_together = ("table_name", "object_identifier")

    __include_in_export__ = False

    table_name = models.CharField(max_length=48, null=False)
    object_identifier = BoundedBigIntegerField(null=False)
    created_at = models.DateTimeField(null=False, default=timezone.now)

    @staticmethod
    def class_for_silo_mode(silo_mode: SiloMode) -> Type[TombstoneBase] | None:
        if silo_mode == SiloMode.REGION:
            return RegionTombstone
        if silo_mode == SiloMode.CONTROL:
            return ControlTombstone
        return None

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
