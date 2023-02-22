"""Replays storage blob driver module.

Blob drivers are polymorphic on the service abstractions provided by Sentry.  Blob drivers are
not polymorphic on service providers.  Any change of credentials will result in data loss unless
proper steps are taken to migrate your data.
"""
import dataclasses
import functools
import logging
from abc import ABC, abstractmethod
from io import BytesIO
from typing import Any, Callable, Optional, Union

from django.conf import settings
from django.db.utils import IntegrityError

from sentry import options
from sentry.models.file import File, get_storage
from sentry.replays.cache import replay_cache
from sentry.replays.models import ReplayRecordingSegment

logger = logging.getLogger()


@dataclasses.dataclass
class RecordingSegmentStorageMeta:
    project_id: int
    replay_id: str
    segment_id: int
    retention_days: int
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

    def get(self, segment: RecordingSegmentStorageMeta) -> bytes:
        file = File.objects.get(pk=segment.file_id)
        return file.getfile().read()

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

    @cached
    def get(self, segment: RecordingSegmentStorageMeta) -> bytes:
        storage = get_storage(self._make_storage_options())

        blob = storage.open(self.make_key(segment))
        result = blob.read()
        blob.close()
        return result

    def set(self, segment: RecordingSegmentStorageMeta, value: bytes) -> None:
        storage = get_storage(self._make_storage_options())
        storage.save(self.make_key(segment), BytesIO(value))

    def make_key(self, segment: RecordingSegmentStorageMeta) -> str:
        return make_filename(segment)

    def _make_storage_options(self) -> Optional[dict]:
        backend = options.get("replays.storage.backend")
        if not backend:
            return None  # If no custom backend specified fall back to the storage default.

        return {"backend": backend, "options": options.get("replays.storage.options")}


def make_filename(segment: RecordingSegmentStorageMeta) -> str:
    return "{}/{}/{}/{}".format(
        segment.retention_days,
        segment.project_id,
        segment.replay_id,
        segment.segment_id,
    )


def make_storage_driver(organization_id: int) -> Union[FilestoreBlob, StorageBlob]:
    driver_name = settings.SENTRY_REPLAYS_BLOB_DRIVER_ORGS.get(
        organization_id, settings.SENTRY_REPLAYS_BLOB_DRIVER
    )
    return make_storage_driver_from_name(driver_name)


def make_storage_driver_from_name(driver_name: str) -> Union[FilestoreBlob, StorageBlob]:
    if driver_name == "storage":
        return StorageBlob()
    elif driver_name == "filestore":
        return FilestoreBlob()
    else:
        raise ValueError("Invalid driver name specified.")
