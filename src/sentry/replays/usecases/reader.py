from __future__ import annotations

import zlib
from collections.abc import Generator, Iterator
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Any

import sentry_sdk
from django.conf import settings
from django.db.models import Prefetch

from sentry.models.files.file import File
from sentry.models.files.fileblobindex import FileBlobIndex
from sentry.replays.lib.storage import RecordingSegmentStorageMeta, filestore, storage
from sentry.replays.models import ReplayRecordingSegment
from sentry.replays.usecases.pack import unpack
from sentry.replays.usecases.replay import (
    RecordingSegment,
    get_replay,
    get_replay_segment,
    get_replay_segments,
)

# METADATA QUERY BEHAVIOR.


@sentry_sdk.trace
def fetch_segments_metadata(
    project_id: int,
    replay_id: str,
    offset: int,
    limit: int,
) -> list[RecordingSegmentStorageMeta]:
    """Return a list of recording segment storage metadata."""
    if settings.SENTRY_REPLAYS_ATTEMPT_LEGACY_FILESTORE_LOOKUP:
        segments = fetch_filestore_segments_meta(project_id, replay_id, offset, limit)
        if segments:
            return segments

    # If the setting wasn't enabled or no segments were found attempt to lookup using
    # the default storage method.
    return fetch_direct_storage_segments_meta(project_id, replay_id, offset, limit)


def fetch_segment_metadata(
    project_id: int,
    replay_id: str,
    segment_id: int,
) -> RecordingSegmentStorageMeta | None:
    """Return a recording segment storage metadata instance."""
    if settings.SENTRY_REPLAYS_ATTEMPT_LEGACY_FILESTORE_LOOKUP:
        segment = fetch_filestore_segment_meta(project_id, replay_id, segment_id)
        if segment:
            return segment

    # If the setting wasn't enabled or no segments were found attempt to lookup using
    # the default storage method.
    return fetch_direct_storage_segment_meta(project_id, replay_id, segment_id)


@sentry_sdk.trace
def fetch_filestore_segments_meta(
    project_id: int,
    replay_id: str,
    offset: int,
    limit: int,
) -> list[RecordingSegmentStorageMeta]:
    """Return filestore metadata derived from our Postgres table."""
    segments = (
        ReplayRecordingSegment.objects.filter(project_id=project_id, replay_id=replay_id)
        .order_by("segment_id")
        .all()[offset : limit + offset]
    )
    if not segments:
        return []

    files = File.objects.filter(id__in=[segment.file_id for segment in segments]).prefetch_related(
        Prefetch(
            "blobs",
            queryset=FileBlobIndex.objects.select_related("blob").order_by("offset"),
            to_attr="file_blob_indexes",
        )
    )
    file_map = {file.id: file for file in files}

    return [
        RecordingSegmentStorageMeta(
            project_id=project_id,
            replay_id=replay_id,
            segment_id=segment.segment_id,
            retention_days=None,
            date_added=segment.date_added,
            file_id=segment.file_id,
            file=file_map[segment.file_id],
        )
        for segment in segments
    ]


def fetch_filestore_segment_meta(
    project_id: int,
    replay_id: str,
    segment_id: int,
) -> RecordingSegmentStorageMeta | None:
    """Return filestore metadata derived from our Postgres table."""
    segment = ReplayRecordingSegment.objects.filter(
        project_id=project_id,
        replay_id=replay_id,
        segment_id=segment_id,
    ).first()
    if segment is None:
        return None

    return RecordingSegmentStorageMeta(
        project_id=project_id,
        replay_id=replay_id,
        segment_id=segment.segment_id,
        retention_days=None,
        date_added=segment.date_added,
        file_id=segment.file_id,
    )


@sentry_sdk.trace
def fetch_direct_storage_segments_meta(
    project_id: int,
    replay_id: str,
    offset: int,
    limit: int,
) -> list[RecordingSegmentStorageMeta]:
    """Return direct-storage metadata derived from our Clickhouse table."""
    replay = get_replay(
        project_ids=[project_id],
        replay_id=replay_id,
        only_query_for={"is_archived"},
        referrer="project.recording_segments.index.has_archived",
    )
    if not replay or replay["is_archived"]:
        return []

    return [
        segment_row_to_storage_meta(segment)
        for segment in get_replay_segments(
            project_id,
            replay_id,
            segment_id=None,
            limit=limit,
            offset=offset,
            referrer="project.recording_segments.index.get_replay_segments",
        )
    ]


def fetch_direct_storage_segment_meta(
    project_id: int,
    replay_id: str,
    segment_id: int,
) -> RecordingSegmentStorageMeta | None:
    """Return direct-storage metadata derived from our Clickhouse table."""
    replay = get_replay(
        project_ids=[project_id],
        replay_id=replay_id,
        only_query_for={"is_archived"},
        referrer="project.recording_segments.details.has_archived",
    )
    if not replay or replay["is_archived"]:
        return None

    segment = get_replay_segment(
        project_id,
        replay_id,
        segment_id,
        referrer="project.recording_segments.details.get_replay_segment",
    )
    if segment:
        return segment_row_to_storage_meta(segment)

    return None


def segment_row_to_storage_meta(segment: RecordingSegment) -> RecordingSegmentStorageMeta:
    return RecordingSegmentStorageMeta(
        project_id=segment["project_id"],
        replay_id=segment["replay_id"],
        segment_id=segment["segment_id"],
        retention_days=segment["retention_days"],
        date_added=datetime.fromisoformat(segment["timestamp"]),
        file_id=None,
    )


# BLOB DOWNLOAD BEHAVIOR.


@sentry_sdk.trace
def download_segments(segments: list[RecordingSegmentStorageMeta]) -> Iterator[bytes]:
    """Download segment data from remote storage."""
    yield b"["

    for i, segment in iter_segment_data(segments):
        yield segment
        if i < len(segments) - 1:
            yield b","

    yield b"]"


def iter_segment_data(
    segments: list[RecordingSegmentStorageMeta],
) -> Generator[tuple[int, memoryview]]:
    with ThreadPoolExecutor(max_workers=10) as pool:
        segment_data = pool.map(_download_segment, segments)

    for i, result in enumerate(segment_data):
        if result is None:
            yield i, memoryview(b"[]")
        else:
            yield i, result[1]


def download_segment(segment: RecordingSegmentStorageMeta, span: Any) -> bytes:
    results = _download_segment(segment)
    return results[1] if results is not None else b"[]"


def download_video(segment: RecordingSegmentStorageMeta) -> bytes | None:
    result = _download_segment(segment)
    if result is not None:
        video, _ = result
        return video
    return None


def _download_segment(
    segment: RecordingSegmentStorageMeta,
) -> tuple[memoryview | None, memoryview] | None:
    driver = filestore if segment.file_id else storage

    result = driver.get(segment)
    if result is None:
        return None

    decompressed = decompress(result)
    return unpack(decompressed)


@sentry_sdk.trace
def decompress(buffer: bytes) -> bytes:
    """Return decompressed output."""
    # If the file starts with a valid JSON character we assume its uncompressed.
    #
    # Going forward all replays are compressed by Relay regardless of their SDK compression
    # state.  This condition will be redundant in the near-future.
    if buffer.startswith(b"["):
        return buffer

    return zlib.decompress(buffer, zlib.MAX_WBITS | 32)
