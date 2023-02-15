"""Replays storage blob driver module.

Blob drivers are polymorphic on the service abstractions provided by Sentry.  Blob drivers are
not polymorphic on service providers.  Any change of credentials will result in data loss unless
proper steps are taken to migrate your data.
"""
import dataclasses
import functools
import logging
import zlib
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
    org_id: int
    project_id: int
    replay_id: str
    segment_id: int
    size: int
    retention_days: int


# Both types implement nearly the same attributes.  One is post-ingest and the other pre-ingest.
SegmentType = Union[ReplayRecordingSegment, RecordingSegmentStorageMeta]


def decompressed(fn: Callable[[Any, SegmentType], bytes]):
    """Decompression wrapper.  Returns decompressed blob data from storage."""

    @functools.wraps(fn)
    def decorator(self, segment: SegmentType) -> bytes:
        buffer = fn(self, segment)

        # If the file starts with a valid JSON character we assume its uncompressed. With time
        # this condition will go extinct. Relay will compress payloads prior to forwarding to
        # the next step.
        if buffer.startswith(b"["):
            return buffer

        # Currently replays are gzipped by Relay.  Historical Replays retain their original gzip
        # compression from the SDK.  In the future we may swap this for zstd or any number of
        # compression algorithms.
        return zlib.decompress(buffer, zlib.MAX_WBITS | 32)

    return decorator


def cached(fn: Callable[[Any, SegmentType], bytes]):
    """Return cached blob data."""

    @functools.wraps(fn)
    def decorator(self, segment: SegmentType) -> bytes:
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
    def delete(self, segment: SegmentType) -> None:
        """Remove a blob from remote storage."""
        raise NotImplementedError

    @abstractmethod
    def get(self, segment: SegmentType) -> bytes:
        """Return blob from remote storage."""
        raise NotImplementedError

    @abstractmethod
    def set(self, segment: RecordingSegmentStorageMeta, value: bytes) -> None:
        """Set blob in remote storage."""
        raise NotImplementedError

    def save_recording_segment(
        self,
        segment: RecordingSegmentStorageMeta,
        driver: int,
        size: int,
        file_id: Optional[int] = None,
    ) -> Optional[ReplayRecordingSegment]:
        try:
            return ReplayRecordingSegment.objects.create(
                retention_days=segment.retention_days,
                org_id=segment.org_id,
                project_id=segment.project_id,
                replay_id=segment.replay_id,
                segment_id=segment.segment_id,
                file_id=file_id,
                driver=driver,
                size=size,
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


class FilestoreBlob(Blob):
    """Filestore service driver blob manager."""

    def delete(self, segment: SegmentType) -> None:
        file = File.objects.get(pk=self.make_key(segment))
        file.delete()

    @decompressed
    def get(self, segment: SegmentType) -> bytes:
        file = File.objects.get(pk=self.make_key(segment))
        return file.getfile().read()

    def set(self, segment: RecordingSegmentStorageMeta, value: bytes) -> None:
        file = File.objects.create(name=make_filename(segment), type="replay.recording")
        file.putfile(BytesIO(value), blob_size=settings.SENTRY_ATTACHMENT_BLOB_SIZE)

        segment = self.save_recording_segment(
            segment,
            driver=ReplayRecordingSegment.FILESTORE,
            size=len(value),
            file_id=file.id,
        )
        if segment is None:
            file.delete()

    def make_key(self, segment: SegmentType) -> int:
        return segment.file_id


class StorageBlob(Blob):
    """Storage service driver blob manager.

    This driver does not have managed TTLs.  To enable TTLs you will need to enable it on your
    bucket.  Keys are prefixed by their TTL.  Those TTLs are 30, 60, 90.  Measured in days.
    """

    def delete(self, segment: SegmentType) -> None:
        storage = get_storage(self._make_storage_options())
        storage.delete(self.make_key(segment))

    @cached
    @decompressed
    def get(self, segment: SegmentType) -> bytes:
        storage = get_storage(self._make_storage_options())

        blob = storage.open(self.make_key(segment))
        result = blob.read()
        blob.close()
        return result

    def set(self, segment: RecordingSegmentStorageMeta, value: bytes) -> None:
        storage = get_storage(self._make_storage_options())
        storage.save(self.make_key(segment), BytesIO(value))

        segment = self.save_recording_segment(
            segment,
            driver=ReplayRecordingSegment.STORAGE,
            size=len(value),
        )
        if segment is None:
            self.delete(segment)

    def make_key(self, segment: SegmentType) -> str:
        return make_filename(segment)

    def _make_storage_options(self) -> Optional[dict]:
        backend = options.get("replays.storage.backend")
        if not backend:
            return None  # If no custom backend specified fall back to the storage default.

        return {"backend": backend, "options": options.get("replays.storage.options")}


def make_filename(segment: SegmentType) -> str:
    return "{}/{}/{}/{}/{}".format(
        segment.retention_days,
        segment.org_id,
        segment.project_id,
        segment.replay_id,
        segment.segment_id,
    )


def make_storage_driver(organization_id: int) -> Union[FilestoreBlob, StorageBlob]:
    driver_name = settings.SENTRY_REPLAYS_BLOB_DRIVER_ORGS.get(
        organization_id, settings.SENTRY_REPLAYS_BLOB_DRIVER
    )
    return make_storage_driver_from_name(driver_name)


def make_storage_driver_from_id(driver_id: int) -> Union[FilestoreBlob, StorageBlob]:
    for choice, label in ReplayRecordingSegment.DRIVER_CHOICES:
        if driver_id == choice:
            return make_storage_driver_from_name(label)
    raise ValueError("Invalid blob storage driver-id specified.")


def make_storage_driver_from_name(driver_name: str) -> Union[FilestoreBlob, StorageBlob]:
    if driver_name == "storage":
        return StorageBlob()
    elif driver_name == "filestore":
        return FilestoreBlob()
    else:
        raise ValueError("Invalid driver name specified.")
