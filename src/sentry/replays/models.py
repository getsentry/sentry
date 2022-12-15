import mimetypes

from django.core.exceptions import ObjectDoesNotExist
from django.db import models
from django.utils import timezone
from django.utils.functional import cached_property

from sentry.db.models import BoundedBigIntegerField, Model, region_silo_only_model, sane_repr
from sentry.db.models.fields.bounded import BoundedIntegerField, BoundedPositiveIntegerField


# Based heavily on EventAttachment
@region_silo_only_model
class ReplayRecordingSegment(Model):
    __include_in_export__ = False

    project_id = BoundedBigIntegerField()
    replay_id = models.CharField(max_length=32, db_index=True)
    file_id = BoundedBigIntegerField(db_index=True)
    segment_id = BoundedIntegerField(db_column="sequence_id")
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

    __repr__ = sane_repr("replay_id", "segment_id", "file_id")

    @cached_property
    def mimetype(self):
        from sentry.models import File

        file = File.objects.get(id=self.file_id)
        rv = file.headers.get("Content-Type")
        if rv:
            return rv.split(";")[0].strip()
        return mimetypes.guess_type(self.name)[0] or "application/octet-stream"

    def delete(self, *args, **kwargs):
        from sentry.models import File

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
