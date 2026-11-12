from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    DefaultFieldsModel,
    cell_silo_model,
    control_silo_model,
    sane_repr,
)

MAX_IDENTIFIER_LENGTH = 63


class BaseOutboxBackfillWatermark(DefaultFieldsModel):
    """
    Records how far the outbox backfill has walked one replicated table.
    """

    class Meta:
        abstract = True

    __relocation_scope__ = RelocationScope.Excluded

    table_name = models.CharField(max_length=MAX_IDENTIFIER_LENGTH)
    # lowest ID that is not yet processed
    low_bound = BoundedBigIntegerField()
    # replication version that the current walk is on
    version = BoundedPositiveIntegerField()

    __repr__ = sane_repr("table_name", "low_bound", "version")


@cell_silo_model
class CellOutboxBackfillWatermark(BaseOutboxBackfillWatermark):
    class Meta:
        app_label = "hybridcloud"
        db_table = "hybridcloud_celloutboxbackfillwatermark"
        constraints = [
            models.UniqueConstraint(
                fields=["table_name"],
                name="hybridcloud_celloutboxbackfillwatermark_key_uniq",
            ),
        ]


@control_silo_model
class ControlOutboxBackfillWatermark(BaseOutboxBackfillWatermark):
    class Meta:
        app_label = "hybridcloud"
        db_table = "hybridcloud_controloutboxbackfillwatermark"
        constraints = [
            models.UniqueConstraint(
                fields=["table_name"],
                name="hybridcloud_controloutboxbackfillwatermark_key_uniq",
            ),
        ]
