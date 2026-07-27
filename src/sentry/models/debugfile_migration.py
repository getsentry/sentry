from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, cell_silo_model, sane_repr
from sentry.db.models.fields.bounded import (
    BoundedBigIntegerField,
    BoundedPositiveBigIntegerField,
    BoundedPositiveIntegerField,
)


class DebugFileObjectstoreMigrationRunStatus(models.IntegerChoices):
    PENDING = 0, "Pending"
    RUNNING = 1, "Running"
    COMPLETED = 2, "Completed"
    FAILED = 3, "Failed"
    SUPERSEDED = 4, "Superseded"


class DebugFileObjectstoreMigrationShardStatus(models.IntegerChoices):
    PENDING = 0, "Pending"
    RUNNING = 1, "Running"
    COMPLETED = 2, "Completed"
    FAILED = 3, "Failed"


@cell_silo_model
class DebugFileObjectstoreMigrationRun(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Excluded

    status = models.SmallIntegerField(
        choices=DebugFileObjectstoreMigrationRunStatus,
        default=DebugFileObjectstoreMigrationRunStatus.PENDING,
        db_default=DebugFileObjectstoreMigrationRunStatus.PENDING,
    )
    generation = BoundedPositiveBigIntegerField(default=1, db_default=1)
    high_water_mark = BoundedBigIntegerField()
    shard_count = BoundedPositiveIntegerField()
    started_at = models.DateTimeField(null=True)
    finished_at = models.DateTimeField(null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_debugfileobjectstoremigrationrun"
        constraints = [
            models.UniqueConstraint(
                models.Value(1),
                condition=models.Q(
                    status__in=(
                        DebugFileObjectstoreMigrationRunStatus.PENDING,
                        DebugFileObjectstoreMigrationRunStatus.RUNNING,
                    )
                ),
                name="sentry_debugfile_objectstore_migration_one_active_run",
            )
        ]

    __repr__ = sane_repr("status", "generation", "high_water_mark", "shard_count")


@cell_silo_model
class DebugFileObjectstoreMigrationShard(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Excluded

    run = FlexibleForeignKey(
        "sentry.DebugFileObjectstoreMigrationRun",
        on_delete=models.CASCADE,
        related_name="shards",
    )
    shard_id = BoundedPositiveIntegerField()
    status = models.SmallIntegerField(
        choices=DebugFileObjectstoreMigrationShardStatus,
        default=DebugFileObjectstoreMigrationShardStatus.PENDING,
        db_default=DebugFileObjectstoreMigrationShardStatus.PENDING,
    )
    generation = BoundedPositiveBigIntegerField(default=1, db_default=1)
    task_generation = BoundedPositiveBigIntegerField(default=0, db_default=0)
    cursor_id = BoundedBigIntegerField(default=0, db_default=0)
    files_migrated = BoundedPositiveBigIntegerField(default=0, db_default=0)
    files_skipped = BoundedPositiveBigIntegerField(default=0, db_default=0)
    bytes_migrated = BoundedPositiveBigIntegerField(default=0, db_default=0)
    started_at = models.DateTimeField(null=True)
    finished_at = models.DateTimeField(null=True)
    failing_debug_file_id = BoundedBigIntegerField(null=True)
    last_error = models.CharField(max_length=256, null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_debugfileobjectstoremigrationshard"
        constraints = [
            models.UniqueConstraint(
                fields=["run", "shard_id"],
                name="sentry_debugfile_objectstore_migration_unique_shard",
            )
        ]
        indexes = [models.Index(fields=["run", "status"])]

    __repr__ = sane_repr("run_id", "shard_id", "status", "cursor_id")
