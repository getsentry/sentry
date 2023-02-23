from __future__ import annotations

import uuid
import zlib
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from typing import List

from snuba_sdk import (
    Column,
    Condition,
    Direction,
    Entity,
    Granularity,
    Limit,
    Op,
    OrderBy,
    Query,
    Request,
)

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
) -> RecordingSegmentStorageMeta | None:
    """Return a recording segment storage metadata instance."""
    # TODO: Filestore is privileged until the direct storage is released to all projects.  Once
    # direct-storage is the default driver we need to invert this.  90 days after deployment we
    # need to remove filestore querying.
    segment = fetch_filestore_segment_meta(project_id, replay_id, segment_id)
    if segment:
        return segment

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
            date_added=segment.date_added,
            file_id=segment.file_id,
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
        retention_days=0,
        date_added=segment.date_added,
        file_id=segment.file_id,
    )


def fetch_direct_storage_segments_meta(
    project_id: int,
    replay_id: str,
    offset: int,
    limit: int,
) -> List[RecordingSegmentStorageMeta]:
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
) -> List[RecordingSegmentStorageMeta]:
    conditions = []
    if segment_id:
        conditions.append(Condition(Column("segment_id"), Op.EQ, segment_id))

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
                # NOTE: Optimization to reduce the number of rows before the LIMIT clause. The
                # cursors happen to map 1 to 1 with segment_id. If these filters are removed
                # you will need to supply an offset value.
                Condition(Column("segment_id"), Op.GTE, offset),
                Condition(Column("segment_id"), Op.LT, offset + limit),
                # Used to dynamically pass the "segment_id" condition for details requests.
                *conditions,
            ],
            orderby=[OrderBy(Column("segment_id"), Direction.ASC)],
            granularity=Granularity(3600),
            limit=Limit(limit),
            # NOTE: We do not use the offset parameter because of the segment_id query optimization
            # in the where clause.  If you remove the segment_id filters you need to uncomment this
            # offset value.
            #
            # offset=Offset(0),
        ),
    )
    response = raw_snql_query(snuba_request, "replays.query.download_replay_segments")

    return [
        RecordingSegmentStorageMeta(
            project_id=project_id,
            replay_id=replay_id,
            segment_id=item["segment_id"],
            retention_days=item["retention_days"],
            date_added=item["timestamp"],
            file_id=None,
        )
        for item in response["data"]
    ]


# BLOB DOWNLOAD BEHAVIOR.


def download_segments(segments: List[RecordingSegmentStorageMeta]) -> str:
    """Download segment data from remote storage."""
    with ThreadPoolExecutor(max_workers=4) as exe:
        results = exe.map(download_segment, segments)
        return (b"[" + b",".join(results) + b"]").decode("utf-8")


def download_segment(segment: RecordingSegmentStorageMeta) -> bytes:
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
