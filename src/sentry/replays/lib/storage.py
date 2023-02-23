"""Replays storage blob driver module.

Blob drivers are polymorphic on the service abstractions provided by Sentry.  Blob drivers are
not polymorphic on service providers.  Any change of credentials will result in data loss unless
proper steps are taken to migrate your data.
"""
import dataclasses
import functools
import logging
from abc import ABC, abstractmethod
from datetime import datetime
from io import BytesIO
from typing import Any, Callable, Optional, Union

from django.conf import settings
from django.db.utils import IntegrityError

from sentry import options
from sentry.models.file import File, get_storage
from sentry.replays.cache import replay_cache
from sentry.replays.models import ReplayRecordingSegment
from sentry.utils import metrics

logger = logging.getLogger()


@dataclasses.dataclass
class RecordingSegmentStorageMeta:
    project_id: int
    replay_id: str
    segment_id: int
    retention_days: int
    date_added: Optional[datetime] = None
    file_id: Optional[int] = None


def cached(fn: Callable[[Any, RecordingSegmentStorageMeta], bytes]):
    """Return cached blob data."""

    @functools.wraps(fn)
    def decorator(self, segment: RecordingSegmentStorageMeta) -> bytes:
        cache_key = make_filename(segment)

        # Fetch the recording-segment from cache if possible.
        cache_value = replay_cache.get(cache_key, raw=True)
        if cache_value:
            return cache_value

        # Fetch the recording-segment from storage and cache before returning a response.
        value = fn(self, segment)
        replay_cache.set(cache_key, value, timeout=3600, raw=True)
        return value

    return decorator


class Blob(ABC):
    @abstractmethod
    def delete(self, segment: RecordingSegmentStorageMeta) -> None:
        """Remove a blob from remote storage."""
        raise NotImplementedError

    @abstractmethod
    def get(self, segment: RecordingSegmentStorageMeta) -> bytes:
        """Return blob from remote storage."""
        raise NotImplementedError

    @abstractmethod
    def set(self, segment: RecordingSegmentStorageMeta, value: bytes) -> None:
        """Set blob in remote storage."""
        raise NotImplementedError


class FilestoreBlob(Blob):
    """Filestore service driver blob manager."""

    def delete(self, segment: RecordingSegmentStorageMeta) -> None:
        file = File.objects.get(pk=segment.file_id)
        file.delete()

    @metrics.wraps("replays.lib.storage.FilestoreBlob.get")
    def get(self, segment: RecordingSegmentStorageMeta) -> bytes:
        file = File.objects.get(pk=segment.file_id)
        return file.getfile().read()

    @metrics.wraps("replays.lib.storage.FilestoreBlob.set")
    def set(self, segment: RecordingSegmentStorageMeta, value: bytes) -> None:
        file = File.objects.create(name=make_filename(segment), type="replay.recording")
        file.putfile(BytesIO(value), blob_size=settings.SENTRY_ATTACHMENT_BLOB_SIZE)

        try:
            segment = ReplayRecordingSegment.objects.create(
                project_id=segment.project_id,
                replay_id=segment.replay_id,
                segment_id=segment.segment_id,
                file_id=file.id,
                size=len(value),
            )
        except IntegrityError:
            logger.warning(
                "Recording-segment has already been processed.",
                extra={
                    "replay_id": segment.replay_id,
                    "project_id": segment.project_id,
                    "segment_id": segment.segment_id,
                },
            )

            # Delete the file from remote storage since it is un-retrievable.
            file.delete()


class StorageBlob(Blob):
    """Storage service driver blob manager.

    This driver does not have managed TTLs.  To enable TTLs you will need to enable it on your
    bucket.  Keys are prefixed by their TTL.  Those TTLs are 30, 60, 90.  Measured in days.
    """

    def delete(self, segment: RecordingSegmentStorageMeta) -> None:
        storage = get_storage(self._make_storage_options())
        storage.delete(self.make_key(segment))

    @metrics.wraps("replays.lib.storage.StorageBlob.get")
    @cached
    def get(self, segment: RecordingSegmentStorageMeta) -> bytes:
        storage = get_storage(self._make_storage_options())

        blob = storage.open(self.make_key(segment))
        result = blob.read()
        blob.close()
        return result

    @metrics.wraps("replays.lib.storage.StorageBlob.set")
    def set(self, segment: RecordingSegmentStorageMeta, value: bytes) -> None:
        storage = get_storage(self._make_storage_options())
        storage.save(self.make_key(segment), BytesIO(value))

    def make_key(self, segment: RecordingSegmentStorageMeta) -> str:
        return make_filename(segment)

    def _make_storage_options(self) -> Optional[dict]:
        backend = options.get("replay.storage.backend")
        if backend:
            return {"backend": backend, "options": options.get("replay.storage.options")}


def make_filename(segment: RecordingSegmentStorageMeta) -> str:
    """Return a deterministic segment filename.

    Filename prefixes have special ordering requirements.  The first prefix "retention days" is
    used for managing TTLs.  The project_id and replay_id prefixes are used for managing user
    and GDPR deletions.
    """
    return "{}/{}/{}/{}".format(
        segment.retention_days,
        segment.project_id,
        segment.replay_id,
        segment.segment_id,
    )


def make_storage_driver(organization_id: int) -> Union[FilestoreBlob, StorageBlob]:
    """Return a storage driver instance."""
    if organization_id % 100 > options.get("replays.storage.direct-storage-sample-rate"):
        return StorageBlob()
    elif organization_id in settings.SENTRY_REPLAYS_STORAGE_ALLOWLIST:
        return StorageBlob()
    else:
        return FilestoreBlob()
