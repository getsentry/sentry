from django.db import models

import sentry
from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model


@region_silo_model
class ErrorBackfillStatus(DefaultFieldsModel):
    """
    Tracks the backfill status for creating DetectorGroup records for error detectors.

    This model coordinates the gradual backfill of DetectorGroup associations for existing
    error groups. Each record represents an error detector (one per project) that needs all
    of its groups to be associated with DetectorGroup records. The status field tracks progress
    through the backfill lifecycle.
    """

    __relocation_scope__ = RelocationScope.Excluded

    detector = FlexibleForeignKey("workflow_engine.Detector", on_delete=models.CASCADE, unique=True)

    # Status values: not_started, in_progress, completed
    status = models.CharField(
        max_length=20,
        choices=[
            ("not_started", "Not Started"),
            ("in_progress", "In Progress"),
            ("completed", "Completed"),
        ],
        default="not_started",
        db_index=True,
    )

    class Meta:
        db_table = "workflow_engine_error_backfill_status"
        app_label = "workflow_engine"
        indexes = [
            models.Index(fields=["status", "date_updated"], name="errbkfl_stat_upd_idx"),
        ]

    __repr__ = sentry.db.models.sane_repr("detector_id", "status")
