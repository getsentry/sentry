from django.core.exceptions import ObjectDoesNotExist
from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import BoundedBigIntegerField, Model, region_silo_model, sane_repr
from sentry.db.models.fields.bounded import BoundedIntegerField, BoundedPositiveIntegerField


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
        indexes = (models.Index(fields=("replay_id", "segment_id")),)
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


@region_silo_model
class FilePart(Model):
    __relocation_scope__ = RelocationScope.Excluded

    date_added = models.DateTimeField(default=timezone.now, null=False)
    filename = models.CharField(null=False)
    key = models.CharField(db_index=True, null=False)
    range_start = models.IntegerField(null=False)
    range_stop = models.IntegerField(null=False)

    class Meta:
        app_label = "replays"
        db_table = "replays_filepart"
