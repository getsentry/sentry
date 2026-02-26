from __future__ import annotations

from enum import IntEnum

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import region_silo_model
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.bounded import BoundedPositiveIntegerField
from sentry.db.models.fields.foreignkey import FlexibleForeignKey


@region_silo_model
class PreprodSnapshotMetrics(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Excluded

    preprod_artifact = models.OneToOneField(
        "preprod.PreprodArtifact",
        on_delete=models.CASCADE,
    )

    image_count = BoundedPositiveIntegerField(default=0)

    # Other future fields like carry forward references (selective testing),
    # history support, etc.

    # Miscellaneous fields that we don't need columns for, e.g. enqueue/dequeue times, user-agent, etc.
    extras = models.JSONField(null=True)

    class Meta:
        app_label = "preprod"
        db_table = "sentry_preprodsnapshotmetrics"


# Comparison manifest will live in objectstore and contain image-specific pointers
# Stored at {artifact.id}/{head_snapshot_run.id}/{base_snapshot_run.id}/comparison.json
@region_silo_model
class PreprodSnapshotComparison(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Excluded

    class State(IntEnum):
        PENDING = 0
        PROCESSING = 1
        SUCCESS = 2
        FAILED = 3

        @classmethod
        def as_choices(cls) -> tuple[tuple[int, str], ...]:
            return (
                (cls.PENDING, "pending"),
                (cls.PROCESSING, "processing"),
                (cls.SUCCESS, "success"),
                (cls.FAILED, "failed"),
            )

    class ErrorCode(IntEnum):
        UNKNOWN = 0
        TIMEOUT = 1
        INTERNAL_ERROR = 2

        @classmethod
        def as_choices(cls) -> tuple[tuple[int, str], ...]:
            return (
                (cls.UNKNOWN, "unknown"),
                (cls.TIMEOUT, "timeout"),
                (cls.INTERNAL_ERROR, "internal_error"),
            )

    state = BoundedPositiveIntegerField(default=State.PENDING, choices=State.as_choices())

    head_snapshot_metrics = FlexibleForeignKey(
        "preprod.PreprodSnapshotMetrics",
        on_delete=models.CASCADE,
        related_name="snapshot_comparisons_head_metrics",
    )
    base_snapshot_metrics = FlexibleForeignKey(
        "preprod.PreprodSnapshotMetrics",
        on_delete=models.CASCADE,
        related_name="snapshot_comparisons_base_metrics",
    )

    error_code = BoundedPositiveIntegerField(choices=ErrorCode.as_choices(), null=True)
    error_message = models.TextField(null=True)

    # Summary statistics
    images_added = BoundedPositiveIntegerField(default=0)
    images_removed = BoundedPositiveIntegerField(default=0)
    images_changed = BoundedPositiveIntegerField(default=0)
    images_unchanged = BoundedPositiveIntegerField(default=0)
    images_renamed = BoundedPositiveIntegerField(default=0)

    # Miscellaneous fields that we don't need columns for
    extras = models.JSONField(null=True)

    class Meta:
        app_label = "preprod"
        db_table = "sentry_preprodsnapshotcomparison"
        unique_together = ("head_snapshot_metrics", "base_snapshot_metrics")
