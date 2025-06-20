from django.contrib.postgres.fields.array import ArrayField
from django.core.exceptions import ObjectDoesNotExist
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedBigIntegerField,
    DefaultFieldsModel,
    Model,
    region_silo_model,
    sane_repr,
)
from sentry.db.models.fields.bounded import BoundedIntegerField, BoundedPositiveIntegerField


class DeletionJobStatus(models.TextChoices):
    PENDING = "pending", gettext_lazy("Pending")
    IN_PROGRESS = "in-progress", gettext_lazy("In Progress")
    COMPLETED = "completed", gettext_lazy("Completed")


@region_silo_model
class ReplayDeletionJobModel(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Excluded

    range_start = models.DateTimeField()
    range_end = models.DateTimeField()
    environments = ArrayField(models.TextField(), default=list)
    organization_id = BoundedBigIntegerField(db_index=True)
    project_id = BoundedBigIntegerField(db_index=True)
    status = models.CharField(choices=DeletionJobStatus.choices, default=DeletionJobStatus.PENDING)
    query = models.TextField()
    offset = models.IntegerField(default=0)

    class Meta:
        app_label = "replays"
        db_table = "replays_replaydeletionjob"


# Based heavily on EventAttachment
@region_silo_model
class ReplayRecordingSegment(Model):
    __relocation_scope__ = RelocationScope.Excluded

    project_id = BoundedBigIntegerField()
    replay_id = models.CharField(max_length=32, db_index=True)
    file_id = BoundedBigIntegerField(db_index=True)
    segment_id = BoundedIntegerField(db_column="sequence_id")
    date_added = models.DateTimeField(default=timezone.now, db_index=True)
    size = BoundedPositiveIntegerField(null=True)

    class Meta:
        app_label = "replays"
        db_table = "replays_replayrecordingsegment"
        unique_together = (
            ("project_id", "replay_id", "file_id"),
            ("project_id", "replay_id", "segment_id"),
        )

    __repr__ = sane_repr("replay_id", "segment_id", "file_id")

    def delete(self, *args, **kwargs):
        from sentry.models.files.file import File

        try:
            file = File.objects.get(id=self.file_id)
        except ObjectDoesNotExist:
            # It's possible that the File itself was deleted
            # before we were deleted when the object is in memory
            # This seems to be a case that happens during deletion
            # code.
            pass
        else:
            file.delete()

        rv = super().delete(*args, **kwargs)
        return rv
