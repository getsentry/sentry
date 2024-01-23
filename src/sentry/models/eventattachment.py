import mimetypes
import random
from dataclasses import dataclass
from hashlib import sha1
from io import BytesIO
from typing import IO, Optional

import zstandard
from django.conf import settings
from django.core.cache import cache
from django.core.exceptions import ObjectDoesNotExist
from django.db import models
from django.utils import timezone

from sentry import options
from sentry.attachments.base import CachedAttachment
from sentry.backup.scopes import RelocationScope
from sentry.db.models import BoundedBigIntegerField, Model, region_silo_only_model, sane_repr
from sentry.db.models.fields.bounded import BoundedIntegerField
from sentry.models.files.utils import get_size_and_checksum, get_storage

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


@dataclass(frozen=True)
class PutfileResult:
    content_type: str
    size: int
    sha1: str
    file_id: Optional[int] = None
    blob_path: Optional[str] = None


@region_silo_only_model
class EventAttachment(Model):
    """Attachment Metadata and Storage

    The actual attachment data can be saved in different backing stores:
    - Using the :class:`File` model using the `file_id` field.
      This stores attachments chunked and deduplicated.
    - When the `blob_path` field has a `eventattachments/v1/` prefix:
      In this case, the default :func:`get_storage` is used as the backing store.
      The attachment data is not chunked or deduplicated in this case.
      However, it is `zstd` compressed.
    """

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
        index_together = (("project_id", "date_added"), ("project_id", "event_id"))

    __repr__ = sane_repr("event_id", "name")

    def delete(self, *args, **kwargs):
        rv = super().delete(*args, **kwargs)

        if self.group_id and self.type in CRASH_REPORT_TYPES:
            # Prune the group cache even if there would be more crash reports
            # stored than the now configured limit, the cache will be
            # repopulated with the next incoming crash report.
            cache.delete(get_crashreport_key(self.group_id))

        if self.blob_path:
            if self.blob_path.startswith("eventattachments/v1/"):
                storage = get_storage()
            else:
                raise NotImplementedError()

            storage.delete(self.blob_path)
            return rv

        try:
            from sentry.models.files.file import File

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

    def getfile(self) -> IO:
        if self.size == 0:
            return BytesIO(b"")

        if self.blob_path:
            if self.blob_path.startswith("eventattachments/v1/"):
                storage = get_storage()
                compressed_blob = storage.open(self.blob_path)
                dctx = zstandard.ZstdDecompressor()
                return dctx.stream_reader(compressed_blob, read_across_frames=True)
            else:
                raise NotImplementedError()

        from sentry.models.files.file import File

        file = File.objects.get(id=self.file_id)
        return file.getfile()

    @classmethod
    def putfile(cls, project_id: int, attachment: CachedAttachment) -> PutfileResult:
        from sentry.models.files import File, FileBlob

        content_type = normalize_content_type(attachment.content_type, attachment.name)

        if len(attachment.data) == 0:
            return PutfileResult(content_type=content_type, size=0, sha1=sha1().hexdigest())

        blob = BytesIO(attachment.data)

        store_blobs = project_id in options.get("eventattachments.store-blobs.projects") or (
            random.random() < options.get("eventattachments.store-blobs.sample-rate")
        )

        if store_blobs:
            size, checksum = get_size_and_checksum(blob)
            blob_path = "eventattachments/v1/" + FileBlob.generate_unique_path()

            storage = get_storage()
            compressed_blob = BytesIO(zstandard.compress(attachment.data))
            storage.save(blob_path, compressed_blob)

            return PutfileResult(
                content_type=content_type, size=size, sha1=checksum, blob_path=blob_path
            )

        file = File.objects.create(
            name=attachment.name,
            type=attachment.type,
            headers={"Content-Type": content_type},
        )
        file.putfile(blob, blob_size=settings.SENTRY_ATTACHMENT_BLOB_SIZE)

        return PutfileResult(
            content_type=content_type, size=file.size, sha1=file.checksum, file_id=file.id
        )


def normalize_content_type(content_type: str | None, name: str) -> str:
    if content_type:
        return content_type.split(";")[0].strip()
    return mimetypes.guess_type(name)[0] or "application/octet-stream"
