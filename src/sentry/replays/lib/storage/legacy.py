"""Replays storage blob driver module.

Blob drivers are polymorphic on the service abstractions provided by Sentry.  Blob drivers are
not polymorphic on service providers.  Any change of credentials will result in data loss unless
proper steps are taken to migrate your data.

This module contains legacy interfaces. They are read and delete only! Do not implement writing
for these interfaces.
"""

import dataclasses
import logging
from abc import ABC, abstractmethod
from datetime import datetime

from sentry.models.files.file import File
from sentry.replays.lib.storage.blob import storage_kv
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


class Blob(ABC):
    @abstractmethod
    def delete(self, segment: RecordingSegmentStorageMeta) -> None:
        """Remove a blob from remote storage."""
        raise NotImplementedError

    @abstractmethod
    def get(self, segment: RecordingSegmentStorageMeta) -> bytes | None:
        """Return blob from remote storage."""
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

    def initialize_client(self):
        return storage_kv.initialize_client()

    def make_key(self, segment: RecordingSegmentStorageMeta) -> str:
        return make_recording_filename(
            segment.retention_days,
            segment.project_id,
            segment.replay_id,
            segment.segment_id,
        )


def make_filename(segment: RecordingSegmentStorageMeta) -> str:
    return make_recording_filename(
        segment.retention_days,
        segment.project_id,
        segment.replay_id,
        segment.segment_id,
    )


def make_recording_filename(
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


def make_video_filename(
    retention_days: int | None,
    project_id: int,
    replay_id: str,
    segment_id: int,
) -> str:
    """Return a recording segment video filename."""
    filename = make_recording_filename(retention_days, project_id, replay_id, segment_id)
    return filename + ".video"


# Filestore interface. Legacy interface which supports slow-to-update self-hosted users.
# Can only read and delete! No new writes.
filestore = FilestoreBlob()

# Recording segment blob interface. Legacy interface for supporting filestore interop.
# Can only read and delete! No new writes.
storage = StorageBlob()
