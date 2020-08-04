from __future__ import absolute_import

from django.core.cache import cache
from django.core.exceptions import ObjectDoesNotExist
from django.db import models
from django.utils import timezone

from sentry.db.models import BoundedBigIntegerField, FlexibleForeignKey, Model, sane_repr


# Attachment file types that are considered a crash report (PII relevant)
CRASH_REPORT_TYPES = ("event.minidump", "event.applecrashreport")


def get_crashreport_key(group_id):
    """
    Returns the ``django.core.cache`` key for groups that have exceeded their
    configured crash report limit.
    """
    return u"cr:%s" % (group_id,)


class EventAttachment(Model):
    __core__ = False

    project_id = BoundedBigIntegerField()
    group_id = BoundedBigIntegerField(null=True, db_index=True)
    event_id = models.CharField(max_length=32, db_index=True)
    file = FlexibleForeignKey("sentry.File")
    name = models.TextField()
    date_added = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_eventattachment"
        index_together = (("project_id", "date_added"), ("project_id", "date_added", "file"))
        unique_together = (("project_id", "event_id", "file"),)

    __repr__ = sane_repr("event_id", "name", "file_id")

    def delete(self, *args, **kwargs):
        rv = super(EventAttachment, self).delete(*args, **kwargs)

        # Always prune the group cache. Even if there are more crash reports
        # stored than the now configured limit, the cache will be repopulated
        # with the next incoming crash report.
        cache.delete(get_crashreport_key(self.group_id))

        try:
            file = self.file
        except ObjectDoesNotExist:
            # It's possible that the File itself was deleted
            # before we were deleted when the object is in memory
            # This seems to be a case that happens during deletion
            # code.
            pass
        else:
            file.delete()

        return rv
