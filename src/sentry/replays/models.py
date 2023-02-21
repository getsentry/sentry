from django.db import models
from django.utils import timezone

from sentry.db.models import BoundedBigIntegerField, Model, region_silo_only_model, sane_repr
from sentry.db.models.fields.bounded import BoundedIntegerField, BoundedPositiveIntegerField


@region_silo_only_model
class ReplayRecordingSegment(Model):
    __include_in_export__ = False

    FILESTORE = 0
    STORAGE = 1
    DRIVER_CHOICES = [(FILESTORE, "filestore"), (STORAGE, "storage")]

    driver = models.SmallIntegerField(choices=DRIVER_CHOICES, default=FILESTORE)
    project_id = BoundedBigIntegerField()
    replay_id = models.CharField(max_length=32, db_index=True)
    segment_id = BoundedIntegerField(db_column="sequence_id")
    file_id = BoundedBigIntegerField(db_index=True, null=True)
    date_added = models.DateTimeField(default=timezone.now, db_index=True)
    size = BoundedPositiveIntegerField(null=True)

    class Meta:
        app_label = "replays"
        db_table = "replays_replayrecordingsegment"
        index_together = (("replay_id", "segment_id"),)
        unique_together = (
            ("project_id", "replay_id", "file_id"),
            ("project_id", "replay_id", "segment_id"),
        )

    __repr__ = sane_repr("replay_id", "segment_id")

    def delete(self, *args, **kwargs):
        return super().delete(*args, **kwargs)
