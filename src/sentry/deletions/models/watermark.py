from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedBigIntegerField,
    DefaultFieldsModel,
    cell_silo_model,
    control_silo_model,
    sane_repr,
)

MAX_IDENTIFIER_LENGTH = 63
MAX_TRANSACTION_ID_LENGTH = 40


class BaseDeletionWatermark(DefaultFieldsModel):
    """
    Records how far the hybrid cloud deletion cascade has processed one
    HybridCloudForeignKey column.
    """

    class Meta:
        abstract = True

    __relocation_scope__ = RelocationScope.Excluded

    prefix = models.CharField(max_length=32)  # "row" or "tombstone"
    table_name = models.CharField(max_length=MAX_IDENTIFIER_LENGTH)
    field_name = models.CharField(max_length=MAX_IDENTIFIER_LENGTH)
    low_bound = BoundedBigIntegerField()
    transaction_id = models.CharField(max_length=MAX_TRANSACTION_ID_LENGTH)

    __repr__ = sane_repr("prefix", "table_name", "field_name", "low_bound")


@cell_silo_model
class CellDeletionWatermark(BaseDeletionWatermark):
    class Meta:
        app_label = "sentry"
        db_table = "sentry_celldeletionwatermark"
        constraints = [
            models.UniqueConstraint(
                fields=["prefix", "table_name", "field_name"],
                name="sentry_celldeletionwatermark_key_uniq",
            ),
        ]


@control_silo_model
class ControlDeletionWatermark(BaseDeletionWatermark):
    class Meta:
        app_label = "sentry"
        db_table = "sentry_controldeletionwatermark"
        constraints = [
            models.UniqueConstraint(
                fields=["prefix", "table_name", "field_name"],
                name="sentry_controldeletionwatermark_key_uniq",
            ),
        ]
