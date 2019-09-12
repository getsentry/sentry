from __future__ import absolute_import

from django.db import models
from django.utils import timezone

from sentry.db.models import BoundedBigIntegerField, FlexibleForeignKey, Model, sane_repr


class EventAttachment(Model):
    __core__ = False

    project_id = BoundedBigIntegerField()
    event_id = models.CharField(max_length=32, db_index=True)
    file = FlexibleForeignKey("sentry.File")
    name = models.TextField()
    date_added = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_eventattachment"
        index_together = (("project_id", "date_added"),)
        unique_together = (("project_id", "event_id", "file"),)

    __repr__ = sane_repr("event_id", "name", "file_id")

    def delete(self, *args, **kwargs):
        super(EventAttachment, self).delete(*args, **kwargs)
        self.file.delete()
