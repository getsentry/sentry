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
    retention_days: int | None
    date_added: datetime | None = None
    file_id: int | None = None
    file: File | None = None


def make_recording_filename(segment: RecordingSegmentStorageMeta) -> str:
    return _make_recording_filename(
        segment.retention_days,
        segment.project_id,
        segment.replay_id,
        segment.segment_id,
    )


def make_video_filename(segment: RecordingSegmentStorageMeta) -> str:
    return _make_video_filename(
        segment.retention_days,
        segment.project_id,
        segment.replay_id,
        segment.segment_id,
    )


def _make_recording_filename(
    retention_days: int | None,
    project_id: int,
    replay_id: str,
    segment_id: int,
) -> str:
    """Return a recording segment filename."""
    return "{}/{}/{}/{}".format(
        retention_days or 30,
        project_id,
        replay_id,
        segment_id,
    )


def _make_video_filename(
    retention_days: int | None,
    project_id: int,
    replay_id: str,
    segment_id: int,
) -> str:
    """Return a recording segment video filename."""
    filename = _make_recording_filename(retention_days, project_id, replay_id, segment_id)
    return filename + ".video"


class Blob(ABC):
    @abstractmethod
    def delete(self, segment: RecordingSegmentStorageMeta) -> None:
        """Remove a blob from remote storage."""
        raise NotImplementedError

    @abstractmethod
    def get(self, segment: RecordingSegmentStorageMeta) -> bytes | None:
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

        file = File.objects.create(name=make_recording_filename(segment), type="replay.recording")
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
        return storage_kv.delete(self.make_key(segment))

    @metrics.wraps("replays.lib.storage.StorageBlob.get")
    def get(self, segment: RecordingSegmentStorageMeta) -> bytes | None:
        return storage_kv.get(self.make_key(segment))

    @metrics.wraps("replays.lib.storage.StorageBlob.set")
    def set(self, segment: RecordingSegmentStorageMeta, value: bytes) -> None:
        return storage_kv.set(self.make_key(segment), value)

    def initialize_client(self):
        return storage_kv.initialize_client()

    def make_key(self, segment: RecordingSegmentStorageMeta) -> str:
        return _make_recording_filename(
            segment.retention_days,
            segment.project_id,
            segment.replay_id,
            segment.segment_id,
        )


class SimpleStorageBlob:
    @metrics.wraps("replays.lib.storage.SimpleStorageBlob.get")
    def get(self, key: str) -> bytes | None:
        try:
            storage = get_storage(self._make_storage_options())
            blob = storage.open(key)
            result = blob.read()
            blob.close()
        except Exception:
            logger.warning("Storage GET error.")
            return None
        else:
            return result

    @metrics.wraps("replays.lib.storage.SimpleStorageBlob.set")
    def set(self, key: str, value: bytes) -> None:
        storage = get_storage(self._make_storage_options())
        try:
            storage.save(key, BytesIO(value))
        except TooManyRequests:
            # if we 429 because of a dupe segment problem, ignore it
            metrics.incr("replays.lib.storage.TooManyRequests")

    @metrics.wraps("replays.lib.storage.SimpleStorageBlob.delete")
    def delete(self, key: str) -> None:
        storage = get_storage(self._make_storage_options())
        storage.delete(key)

    def initialize_client(self):
        storage = get_storage(self._make_storage_options())
        # acccess the storage client so it is initialized below.
        # this will prevent race condition parallel credential getting during segment download
        # when using many threads
        # the storage client uses a global so we don't need to store it here.
        if hasattr(storage, "client"):
            storage.client

    def _make_storage_options(self) -> dict | None:
        backend = options.get("replay.storage.backend")
        if backend:
            return {"backend": backend, "options": options.get("replay.storage.options")}
        else:
            return None


# Filestore interface. Legacy interface which supports slow-to-update self-hosted users.
filestore = FilestoreBlob()

# Recording segment blob interface. Legacy interface for supporting filestore interop.
storage = StorageBlob()

# Simple Key-value blob storage interface.
storage_kv = SimpleStorageBlob()
