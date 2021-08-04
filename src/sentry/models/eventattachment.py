import mimetypes

from django.core.cache import cache
from django.core.exceptions import ObjectDoesNotExist
from django.db import models
from django.utils import timezone
from django.utils.functional import cached_property

from sentry.db.models import BoundedBigIntegerField, Model, sane_repr

# Attachment file types that are considered a crash report (PII relevant)
CRASH_REPORT_TYPES = ("event.minidump", "event.applecrashreport")


def get_crashreport_key(group_id):
    """
    Returns the ``django.core.cache`` key for groups that have exceeded their
    configured crash report limit.
    """
    return f"cr:{group_id}"


class EventAttachment(Model):
    __include_in_export__ = False

    project_id = BoundedBigIntegerField()
    group_id = BoundedBigIntegerField(null=True, db_index=True)
    event_id = models.CharField(max_length=32, db_index=True)
    file_id = BoundedBigIntegerField(db_index=True)
    type = models.CharField(max_length=64, db_index=True)
    name = models.TextField()
    date_added = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_eventattachment"
        index_together = (("project_id", "date_added"), ("project_id", "date_added", "file_id"))
        unique_together = (("project_id", "event_id", "file_id"),)

    __repr__ = sane_repr("event_id", "name", "file_id")

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

        rv = super().delete(*args, **kwargs)

        if self.group_id and self.type in CRASH_REPORT_TYPES:
            # Prune the group cache even if there would be more crash reports
            # stored than the now configured limit, the cache will be
            # repopulated with the next incoming crash report.
            cache.delete(get_crashreport_key(self.group_id))

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

        return rv
