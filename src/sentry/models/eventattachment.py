from __future__ import annotations

import mimetypes
from dataclasses import dataclass
from hashlib import sha1
from io import BytesIO
from typing import IO, Any

import zstandard
from django.core.cache import cache
from django.db import models
from django.utils import timezone

from sentry.attachments.base import CachedAttachment
from sentry.backup.scopes import RelocationScope
from sentry.db.models import BoundedBigIntegerField, Model, region_silo_model, sane_repr
from sentry.db.models.fields.bounded import BoundedIntegerField
from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.models.files.utils import get_size_and_checksum, get_storage
from sentry.utils import metrics

# Attachment file types that are considered a crash report (PII relevant)
CRASH_REPORT_TYPES = ("event.minidump", "event.applecrashreport")


def get_crashreport_key(group_id: int) -> str:
    """
    Returns the ``django.core.cache`` key for groups that have exceeded their
    configured crash report limit.
    """
    return f"cr:{group_id}"


def event_attachment_screenshot_filter(
    queryset: BaseQuerySet[EventAttachment],
) -> BaseQuerySet[EventAttachment]:
    return queryset.filter(models.Q(name__icontains="screenshot"))


@dataclass(frozen=True)
class PutfileResult:
    content_type: str
    size: int
    sha1: str
    blob_path: str | None = None


def can_store_inline(data: bytes) -> bool:
    """
    Determines whether `data` can be stored inline

    That is the case when it is shorter than 192 bytes,
    and all the bytes are non-NULL ASCII.
    """
    return len(data) < 192 and all(byte > 0x00 and byte < 0x7F for byte in data)


@region_silo_model
class EventAttachment(Model):
    """
    Attachment Metadata and Storage

    The actual attachment data can be saved in different backing stores:
    - When the attachment is empty (0-size), `blob_path is None`.
    - When the `blob_path` field has a `:` prefix:
      It is saved inline in `blob_path` following the `:` prefix.
      This happens for "small" and ASCII-only (see `can_store_inline`) attachments.
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

    # attachment and file metadata:
    type = models.CharField(max_length=64, db_index=True)
    name = models.TextField()
    content_type = models.TextField(null=True)
    size = BoundedIntegerField(null=True)
    sha1 = models.CharField(max_length=40, null=True)

    date_added = models.DateTimeField(default=timezone.now, db_index=True)

    # storage:
    blob_path = models.TextField(null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_eventattachment"
        indexes = (
            models.Index(fields=("project_id", "date_added")),
            models.Index(fields=("project_id", "event_id")),
        )

    __repr__ = sane_repr("event_id", "name")

    def delete(self, *args: Any, **kwargs: Any) -> tuple[int, dict[str, int]]:
        rv = super().delete(*args, **kwargs)

        if self.group_id and self.type in CRASH_REPORT_TYPES:
            # Prune the group cache even if there would be more crash reports
            # stored than the now configured limit, the cache will be
            # repopulated with the next incoming crash report.
            cache.delete(get_crashreport_key(self.group_id))

        if self.blob_path:
            if self.blob_path.startswith(":"):
                pass  # nothing to do for inline-stored attachments
            elif self.blob_path.startswith("eventattachments/v1/"):
                storage = get_storage()
                storage.delete(self.blob_path)
            else:
                raise NotImplementedError()

        return rv

    def getfile(self) -> IO[bytes]:
        if not self.blob_path:
            return BytesIO(b"")

        if self.blob_path.startswith(":"):
            return BytesIO(self.blob_path[1:].encode())

        elif self.blob_path.startswith("eventattachments/v1/"):
            storage = get_storage()
            compressed_blob = storage.open(self.blob_path)
            dctx = zstandard.ZstdDecompressor()
            return dctx.stream_reader(compressed_blob, read_across_frames=True)

        raise NotImplementedError()

    @classmethod
    def putfile(cls, project_id: int, attachment: CachedAttachment) -> PutfileResult:
        from sentry.models.files import FileBlob

        content_type = normalize_content_type(attachment.content_type, attachment.name)
        data = attachment.data

        if len(data) == 0:
            return PutfileResult(content_type=content_type, size=0, sha1=sha1().hexdigest())

        blob = BytesIO(data)
        size, checksum = get_size_and_checksum(blob)

        metrics.distribution(
            "storage.put.size",
            size,
            tags={"usecase": "attachments", "compression": "none"},
            unit="byte",
        )

        if can_store_inline(data):
            blob_path = ":" + data.decode()
        else:
            blob_path = "eventattachments/v1/" + FileBlob.generate_unique_path()

            storage = get_storage()
            compressed_blob = zstandard.compress(data)

            metrics.distribution(
                "storage.put.size",
                len(compressed_blob),
                tags={"usecase": "attachments", "compression": "zstd"},
                unit="byte",
            )
            with metrics.timer("storage.put.latency", tags={"usecase": "attachments"}):
                storage.save(blob_path, BytesIO(compressed_blob))

        return PutfileResult(
            content_type=content_type, size=size, sha1=checksum, blob_path=blob_path
        )


def normalize_content_type(content_type: str | None, name: str) -> str:
    if content_type:
        return content_type.split(";")[0].strip()
    return mimetypes.guess_type(name)[0] or "application/octet-stream"
