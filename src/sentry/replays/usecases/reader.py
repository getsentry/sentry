from __future__ import annotations

import functools
import uuid
import zlib
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta

import sentry_sdk
from django.conf import settings
from django.db.models import Prefetch
from sentry_sdk.tracing import Span
from snuba_sdk import (
    Column,
    Condition,
    Direction,
    Entity,
    Granularity,
    Limit,
    Offset,
    Op,
    OrderBy,
    Query,
    Request,
)

from sentry.models.files.file import File
from sentry.models.files.fileblobindex import FileBlobIndex
from sentry.replays.lib.storage import (
    RecordingSegmentStorageMeta,
    filestore,
    make_video_filename,
    storage,
    storage_kv,
)
from sentry.replays.models import ReplayRecordingSegment
from sentry.utils.snuba import raw_snql_query

# METADATA QUERY BEHAVIOR.


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


def fetch_filestore_segments_meta(
    project_id: int,
    replay_id: str,
    offset: int,
    limit: int,
) -> list[RecordingSegmentStorageMeta]:
    """Return filestore metadata derived from our Postgres table."""
    segments: list[ReplayRecordingSegment] = (
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


def fetch_direct_storage_segments_meta(
    project_id: int,
    replay_id: str,
    offset: int,
    limit: int,
) -> list[RecordingSegmentStorageMeta]:
    """Return direct-storage metadata derived from our Clickhouse table."""
    if not has_archived_segment(project_id, replay_id):
        return _fetch_segments_from_snuba(project_id, replay_id, offset, limit)
    return []


def fetch_direct_storage_segment_meta(
    project_id: int,
    replay_id: str,
    segment_id: int,
) -> RecordingSegmentStorageMeta | None:
    """Return direct-storage metadata derived from our Clickhouse table."""
    if has_archived_segment(project_id, replay_id):
        return None

    results = _fetch_segments_from_snuba(
        project_id=project_id,
        replay_id=replay_id,
        offset=0,
        limit=1,
        segment_id=segment_id,
    )
    if len(results) == 0:
        return None
    else:
        return results[0]


def has_archived_segment(project_id: int, replay_id: str) -> bool:
    """Return true if an archive row exists for this replay."""
    snuba_request = Request(
        dataset="replays",
        app_id="replay-backend-web",
        query=Query(
            match=Entity("replays"),
            select=[Column("is_archived")],
            where=[
                Condition(Column("is_archived"), Op.EQ, 1),
                Condition(Column("project_id"), Op.EQ, project_id),
                Condition(Column("replay_id"), Op.EQ, str(uuid.UUID(replay_id))),
                # We request the full 90 day range. This is effectively an unbounded timestamp
                # range.
                Condition(Column("timestamp"), Op.LT, datetime.now()),
                Condition(Column("timestamp"), Op.GTE, datetime.now() - timedelta(days=90)),
            ],
            granularity=Granularity(3600),
        ),
    )
    response = raw_snql_query(snuba_request, "replays.query.download_replay_segments")
    return len(response["data"]) > 0


def _fetch_segments_from_snuba(
    project_id: int,
    replay_id: str,
    offset: int,
    limit: int,
    segment_id: int | None = None,
) -> list[RecordingSegmentStorageMeta]:
    conditions = []
    if segment_id:
        conditions.append(Condition(Column("segment_id"), Op.EQ, segment_id))
    else:
        conditions.append(Condition(Column("segment_id"), Op.IS_NOT_NULL, None))

    snuba_request = Request(
        dataset="replays",
        app_id="replay-backend-web",
        query=Query(
            match=Entity("replays"),
            select=[Column("segment_id"), Column("retention_days"), Column("timestamp")],
            where=[
                Condition(Column("project_id"), Op.EQ, project_id),
                Condition(Column("replay_id"), Op.EQ, str(uuid.UUID(replay_id))),
                # We request the full 90 day range. This is effectively an unbounded timestamp
                # range.
                Condition(Column("timestamp"), Op.LT, datetime.now()),
                Condition(Column("timestamp"), Op.GTE, datetime.now() - timedelta(days=90)),
                # Used to dynamically pass the "segment_id" condition for details requests.
                *conditions,
            ],
            orderby=[OrderBy(Column("segment_id"), Direction.ASC)],
            granularity=Granularity(3600),
            limit=Limit(limit),
            offset=Offset(offset),
        ),
    )
    response = raw_snql_query(snuba_request, "replays.query.download_replay_segments")

    return [segment_row_to_storage_meta(project_id, replay_id, item) for item in response["data"]]


def segment_row_to_storage_meta(
    project_id: int,
    replay_id: str,
    row,
) -> RecordingSegmentStorageMeta:
    return RecordingSegmentStorageMeta(
        project_id=project_id,
        replay_id=replay_id,
        segment_id=row["segment_id"],
        retention_days=row["retention_days"],
        date_added=datetime.fromisoformat(row["timestamp"]),
        file_id=None,
    )


# BLOB DOWNLOAD BEHAVIOR.


def download_video(segment: RecordingSegmentStorageMeta) -> bytes | None:
    return storage_kv.get(make_video_filename(segment))


def download_segments(segments: list[RecordingSegmentStorageMeta]) -> Iterator[bytes]:
    """Download segment data from remote storage."""

    # start a sentry transaction to pass to the thread pool workers
    with sentry_sdk.start_span(op="download_segments", description="thread_pool") as span:
        download_segment_with_fixed_args = functools.partial(
            download_segment,
            span=span,
        )
        current_hub = sentry_sdk.Hub.current

        yield b"["
        # Map all of the segments to a worker process for download.
        with ThreadPoolExecutor(max_workers=10) as exe:
            with sentry_sdk.Hub(current_hub):
                results = exe.map(download_segment_with_fixed_args, segments)

            for i, result in enumerate(results):
                if result is None:
                    yield b"[]"
                else:
                    yield result

                if i < len(segments) - 1:
                    yield b","
        yield b"]"


def download_segment(
    segment: RecordingSegmentStorageMeta,
    span: Span,
) -> bytes | None:
    """Return the segment blob data."""
    with span.start_child(
        op="download_segment",
        description="thread_task",
    ):
        driver = filestore if segment.file_id else storage
        with sentry_sdk.start_span(
            op="download_segment",
            description="download",
        ):
            result = driver.get(segment)
        if result is None:
            return None

        with sentry_sdk.start_span(
            op="download_segment",
            description="decompress",
        ):
            return decompress(result)


def decompress(buffer: bytes) -> bytes:
    """Return decompressed output."""
    # If the file starts with a valid JSON character we assume its uncompressed.
    #
    # Going forward all replays are compressed by Relay regardless of their SDK compression
    # state.  This condition will be redundant in the near-future.
    if buffer.startswith(b"["):
        return buffer

    return zlib.decompress(buffer, zlib.MAX_WBITS | 32)
