from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, cell_silo_model, sane_repr
from sentry.db.models.fields.bounded import BoundedBigIntegerField, BoundedPositiveIntegerField


@cell_silo_model
class DebugFileObjectstoreMigrationRun(DefaultFieldsModel):
    """One migration campaign: frozen high-water mark + shard partition count.

    The primary key is the natural generation fence: activations always target a
    concrete run id. Progress is observed via logs, not run-level status.
    """

    __relocation_scope__ = RelocationScope.Excluded

    high_water_mark = BoundedBigIntegerField()
    shard_count = BoundedPositiveIntegerField()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_debugfileobjectstoremigrationrun"

    __repr__ = sane_repr("high_water_mark", "shard_count")


@cell_silo_model
class DebugFileObjectstoreMigrationShard(DefaultFieldsModel):
    """Per-run partition cursor. The only durable checkpoint for a shard worker."""

    __relocation_scope__ = RelocationScope.Excluded

    run = FlexibleForeignKey(
        "sentry.DebugFileObjectstoreMigrationRun",
        on_delete=models.CASCADE,
        related_name="shards",
    )
    shard_id = BoundedPositiveIntegerField()
    cursor_id = BoundedBigIntegerField(default=0, db_default=0)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_debugfileobjectstoremigrationshard"
        constraints = [
            models.UniqueConstraint(
                fields=["run", "shard_id"],
                name="sentry_debugfile_objectstore_migration_unique_shard",
            )
        ]

    __repr__ = sane_repr("run_id", "shard_id", "cursor_id")
