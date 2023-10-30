"""Replays storage blob driver module.

Blob drivers are polymorphic on the service abstractions provided by Sentry.  Blob drivers are
not polymorphic on service providers.  Any change of credentials will result in data loss unless
proper steps are taken to migrate your data.
"""
import dataclasses
import logging
from abc import ABC, abstractmethod
from datetime import datetime
from io import BytesIO
from typing import List, Optional, Union

from django.conf import settings
from django.db.utils import IntegrityError
from google.api_core.exceptions import TooManyRequests

from sentry import options
from sentry.models.files.file import File
from sentry.models.files.utils import get_storage
from sentry.replays.models import ReplayRecordingSegment
from sentry.utils import metrics

logger = logging.getLogger()


@dataclasses.dataclass
class RecordingSegmentStorageMeta:
    project_id: int
    replay_id: str
    segment_id: int
    retention_days: Optional[int]
    date_added: Optional[datetime] = None
    file_id: Optional[int] = None
    file: Optional[File] = None


class Blob(ABC):
    @abstractmethod
    def delete(self, segment: RecordingSegmentStorageMeta) -> None:
        """Remove a blob from remote storage."""
        raise NotImplementedError

    @abstractmethod
    def get(self, segment: RecordingSegmentStorageMeta) -> Optional[bytes]:
        """Return blob from remote storage."""
        raise NotImplementedError

    @abstractmethod
    def set(self, segment: RecordingSegmentStorageMeta, value: bytes) -> None:
        """Set blob in remote storage."""
        raise NotImplementedError


class FilestoreBlob(Blob):
    """Filestore service driver blob manager."""

    def delete(self, segment: RecordingSegmentStorageMeta) -> None:
        file = segment.file or File.objects.get(pk=segment.file_id)
        file.delete()

    @metrics.wraps("replays.lib.storage.FilestoreBlob.get")
    def get(self, segment: RecordingSegmentStorageMeta) -> bytes:
        file = segment.file or File.objects.get(pk=segment.file_id)
        return file.getfile().read()

    @metrics.wraps("replays.lib.storage.FilestoreBlob.set")
    def set(self, segment: RecordingSegmentStorageMeta, value: bytes) -> None:
        with metrics.timer("replays.process_recording.store_recording.count_segments"):
            count_existing_segments = ReplayRecordingSegment.objects.filter(
                replay_id=segment.replay_id,
                project_id=segment.project_id,
                segment_id=segment.segment_id,
            ).count()

        if count_existing_segments > 0:
            logging.warning(
                "Recording segment was already processed.",
                extra={
                    "project_id": segment.project_id,
                    "replay_id": segment.replay_id,
                },
            )
            return

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

    def initialize_client(self):
        storage = get_storage(self._make_storage_options())
        # acccess the storage client so it is initialized below.
        # this will prevent race condition parallel credential getting during segment download
        # when using many threads
        # the storage client uses a global so we don't need to store it here.
        if hasattr(storage, "client"):
            storage.client

    def delete(self, segment: RecordingSegmentStorageMeta) -> None:
        storage = get_storage(self._make_storage_options())
        storage.delete(self.make_key(segment))

    @metrics.wraps("replays.lib.storage.StorageBlob.get")
    def get(self, segment: RecordingSegmentStorageMeta) -> Optional[bytes]:
        try:
            storage = get_storage(self._make_storage_options())
            blob = storage.open(self.make_key(segment))
            result = blob.read()
            blob.close()
        except Exception:
            logger.warning("Storage GET error.")
            return None
        else:
            return result

    @metrics.wraps("replays.lib.storage.StorageBlob.set")
    def set(self, segment: RecordingSegmentStorageMeta, value: bytes) -> None:
        storage = get_storage(self._make_storage_options())
        try:
            storage.save(self.make_key(segment), BytesIO(value))
        except TooManyRequests:
            # if we 429 because of a dupe segment problem, ignore it
            metrics.incr("replays.lib.storage.TooManyRequests")
            pass

    def make_key(self, segment: RecordingSegmentStorageMeta) -> str:
        return make_filename(segment)

    def _make_storage_options(self) -> Optional[dict]:
        backend = options.get("replay.storage.backend")
        if backend:
            return {"backend": backend, "options": options.get("replay.storage.options")}
        else:
            return None


def make_filename(segment: RecordingSegmentStorageMeta) -> str:
    """Return a deterministic segment filename.

    Filename prefixes have special ordering requirements.  The first prefix "retention days" is
    used for managing TTLs.  The project_id and replay_id prefixes are used for managing user
    and GDPR deletions.
    """
    # Records retrieved from the File interface do not have a statically defined retention
    # period.  Their retention is dynamic and deleted by an async process.  These filenames
    # default to the 90 day (max) retention period prefix.
    retention_days = segment.retention_days or 90

    return "{}/{}/{}/{}".format(
        retention_days,
        segment.project_id,
        segment.replay_id,
        segment.segment_id,
    )


def make_storage_driver(organization_id: int) -> Union[FilestoreBlob, StorageBlob]:
    """Return a storage driver instance."""
    return _make_storage_driver(
        organization_id,
        options.get("replay.storage.direct-storage-sample-rate"),
        settings.SENTRY_REPLAYS_STORAGE_ALLOWLIST,
    )


def _make_storage_driver(
    organization_id: int,
    sample_rate: int,
    allow_list: List[int],
) -> Union[FilestoreBlob, StorageBlob]:
    if organization_id in allow_list:
        return storage
    elif organization_id % 100 < sample_rate:
        return storage
    else:
        return filestore


storage = StorageBlob()
filestore = FilestoreBlob()
