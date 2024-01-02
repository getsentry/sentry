from django.core.cache import cache
from django.core.exceptions import ObjectDoesNotExist
from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import BoundedBigIntegerField, Model, region_silo_only_model, sane_repr
from sentry.db.models.fields.bounded import BoundedIntegerField

# Attachment file types that are considered a crash report (PII relevant)
CRASH_REPORT_TYPES = ("event.minidump", "event.applecrashreport")


def get_crashreport_key(group_id):
    """
    Returns the ``django.core.cache`` key for groups that have exceeded their
    configured crash report limit.
    """
    return f"cr:{group_id}"


def event_attachment_screenshot_filter(queryset):
    # Intentionally a hardcoded list instead of a regex since current usecases do not have more 3 screenshots
    return queryset.filter(
        name__in=[
            *[f"screenshot{f'-{i}' if i > 0 else ''}.jpg" for i in range(4)],
            *[f"screenshot{f'-{i}' if i > 0 else ''}.png" for i in range(4)],
        ]
    )


@region_silo_only_model
class EventAttachment(Model):
    __relocation_scope__ = RelocationScope.Excluded

    # the things we want to look up attachments by:
    project_id = BoundedBigIntegerField()
    group_id = BoundedBigIntegerField(null=True, db_index=True)
    event_id = models.CharField(max_length=32, db_index=True)

    # attachment and file metadata
    type = models.CharField(max_length=64, db_index=True)
    name = models.TextField()
    content_type = models.TextField(null=True)
    size = BoundedIntegerField(null=True)
    sha1 = models.CharField(max_length=40, null=True)

    date_added = models.DateTimeField(default=timezone.now, db_index=True)

    # the backing blob, either going through the `File` model,
    # or directly to a backing blob store
    file_id = BoundedBigIntegerField(null=True, db_index=True)
    blob_path = models.TextField(null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_eventattachment"
        index_together = ("project_id", "date_added")

    __repr__ = sane_repr("event_id", "name")

    def delete(self, *args, **kwargs):
        from sentry.models.files.file import File

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
