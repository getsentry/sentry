from enum import StrEnum

from django.db import models

import sentry
from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, region_silo_model
from sentry.db.models.fields.jsonfield import JSONField


class BulkJobState(StrEnum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


@region_silo_model
class BulkJobStatus(DefaultFieldsModel):
    """
    Generic tracking model for bulk job execution.

    This model tracks the execution state of bulk jobs. It is completely decoupled from
    job implementation details - all job-specific behavior is defined in BulkJobSpec
    instances that are looked up via the job_type field.
    """

    __relocation_scope__ = RelocationScope.Excluded

    job_type = models.CharField(max_length=100, db_index=True)
    batch_key = models.CharField(max_length=200, unique=True)
    work_chunk_info = JSONField()

    status = models.CharField(
        max_length=20,
        choices=[(status.value, status.name.replace("_", " ").title()) for status in BulkJobState],
        default=BulkJobState.NOT_STARTED,
        db_index=True,
    )

    class Meta:
        db_table = "workflow_engine_bulk_job_status"
        app_label = "workflow_engine"
        indexes = [
            models.Index(
                fields=["job_type", "status", "date_updated"], name="bulkjob_type_stat_upd_idx"
            ),
        ]

    __repr__ = sentry.db.models.sane_repr("job_type", "batch_key", "status")
