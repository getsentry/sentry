from __future__ import annotations

import zlib
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from typing import List

from snuba_sdk import Column, Condition, Entity, Granularity, Limit, Offset, Op, Query, Request

from sentry.replays.lib.storage import FilestoreBlob, RecordingSegmentStorageMeta, StorageBlob
from sentry.replays.models import ReplayRecordingSegment
from sentry.utils.snuba import raw_snql_query

# METADATA QUERY BEHAVIOR.


def fetch_segments_metadata(
    project_id: int,
    replay_id: str,
    offset: int,
    limit: int,
) -> List[RecordingSegmentStorageMeta]:
    """Return a list of recording segment storage metadata."""
    # NOTE: This method can miss segments that were split during the deploy.  E.g. half were on
    # filestore the other half were on direct-storage.

    # TODO: Filestore is privileged until the direct storage is released to all projects.  Once
    # direct-storage is the default driver we need to invert this.  90 days after deployment we
    # need to remove filestore querying.
    segments = fetch_filestore_segments_meta(project_id, replay_id, offset, limit)
    if segments:
        return segments

    return fetch_direct_storage_segments_meta(project_id, replay_id, offset, limit)


def fetch_segment_metadata(
    project_id: int,
    replay_id: str,
    segment_id: int,
) -> List[RecordingSegmentStorageMeta]:
    """Return a recording segment storage metadata instance."""
    # TODO: Filestore is privileged until the direct storage is released to all projects.  Once
    # direct-storage is the default driver we need to invert this.  90 days after deployment we
    # need to remove filestore querying.
    segments = fetch_filestore_segment_meta(project_id, replay_id, segment_id)
    if segments:
        return segments

    return fetch_direct_storage_segment_meta(project_id, replay_id, segment_id)


def fetch_filestore_segments_meta(
    project_id: int,
    replay_id: str,
    offset: int,
    limit: int,
) -> List[RecordingSegmentStorageMeta]:
    """Return filestore metadata derived from our Postgres table."""
    segments: List[ReplayRecordingSegment] = (
        ReplayRecordingSegment.objects.filter(project_id=project_id, replay_id=replay_id)
        .order_by("segment_id")
        .all()[offset : limit + offset]
    )
    return [
        RecordingSegmentStorageMeta(
            project_id=project_id,
            replay_id=replay_id,
            segment_id=segment.segment_id,
            retention_days=0,
            file_id=segment.file_id,
        )
        for segment in segments
    ]


def fetch_filestore_segment_meta(
    project_id: int,
    replay_id: str,
    segment_id: int,
) -> List[RecordingSegmentStorageMeta]:
    """Return filestore metadata derived from our Postgres table."""
    segment: ReplayRecordingSegment = ReplayRecordingSegment.objects.filter(
        project_id=project_id, replay_id=replay_id, segment_id=segment_id
    ).get()

    return RecordingSegmentStorageMeta(
        project_id=project_id,
        replay_id=replay_id,
        segment_id=segment.segment_id,
        retention_days=0,
        file_id=segment.file_id,
    )


def fetch_direct_storage_segments_meta(
    project_id: int,
    replay_id: str,
    offset: int,
    limit: int,
) -> List[RecordingSegmentStorageMeta]:
    """Return direct-storage metadata derived from our Clickhouse table."""
    return _fetch_from_snuba(project_id, replay_id, offset, limit)


def fetch_direct_storage_segment_meta(
    project_id: int,
    replay_id: str,
    segment_id: int,
) -> RecordingSegmentStorageMeta | None:
    """Return direct-storage metadata derived from our Clickhouse table."""
    results = _fetch_from_snuba(
        project_id=project_id,
        replay_id=replay_id,
        offset=0,
        limit=1,
        conditions=[Condition("segment_id", Op.EQ, segment_id)],
    )
    if len(results) == 0:
        return None
    else:
        return results[0]


def _fetch_from_snuba(
    project_id: int,
    replay_id: str,
    offset: int,
    limit: int,
    *conditions,
):
    snuba_request = Request(
        dataset="replays",
        app_id="replay-backend-web",
        query=Query(
            match=Entity("replays"),
            select=[Column("segment_id"), Column("retention_days"), Column("timestamp")],
            where=[
                Condition(Column("project_id"), Op.EQ, project_id),
                Condition(Column("replay_id"), Op.EQ, replay_id),
                # Segment must be in the cursor range.
                # Condition(Column("segment_id"), Op.GTE, offset),
                # Condition(Column("segment_id"), Op.LT, offset + limit),
                # We request the full 90 day range.
                Condition(Column("timestamp"), Op.LT, datetime.now()),
                Condition(Column("timestamp"), Op.GTE, datetime.now() - timedelta(days=90)),
                *conditions,
            ],
            orderby=[Column("segment_id")],
            granularity=Granularity(3600),
            limit=Limit(limit),
            offset=Offset(offset),
        ),
    )
    response = raw_snql_query(snuba_request, "replays.query.download_replay_segments")

    return [
        RecordingSegmentStorageMeta(
            project_id=project_id,
            replay_id=replay_id,
            segment_id=item["segment_id"],
            retention_days=item["retention_days"],
            file_id=None,
        )
        for item in response["data"]
    ]


# BLOB DOWNLOAD BEHAVIOR.


def download_segments(segments: List[RecordingSegmentStorageMeta]):
    """Download segment data from remote storage."""
    with ThreadPoolExecutor(max_workers=4) as exe:
        results = exe.map(download_segment, segments)
        return (b"[" + b",".join(results) + b"]").decode("utf-8")


def download_segment(segment: RecordingSegmentStorageMeta):
    """Return the segment blob data."""
    driver = FilestoreBlob() if segment.file_id else StorageBlob()
    return decompress(driver.get(segment))


def decompress(buffer: bytes) -> bytes:
    """Return decompressed output."""
    # If the file starts with a valid JSON character we assume its uncompressed. With time
    # this condition will go extinct. Relay will compress payloads prior to forwarding to
    # the next step.
    if buffer.startswith(b"["):
        return buffer

    # Currently replays are gzipped by Relay.  Historical Replays retain their original gzip
    # compression from the SDK.  In the future we may swap this for zstd or any number of
    # compression algorithms.
    return zlib.decompress(buffer, zlib.MAX_WBITS | 32)
