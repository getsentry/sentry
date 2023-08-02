from __future__ import annotations

import base64
import functools
import io
import uuid
import zlib
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from typing import Iterator, List, Optional

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

from sentry.models import FilePartModel
from sentry.models.files.file import File, FileBlobIndex
from sentry.models.files.utils import get_storage
from sentry.replays.lib.storage import RecordingSegmentStorageMeta, filestore, storage
from sentry.replays.models import ReplayRecordingSegment
from sentry.utils.crypt_envelope import envelope_decrypt
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

    return [
        RecordingSegmentStorageMeta(
            project_id=project_id,
            replay_id=replay_id,
            segment_id=item["segment_id"],
            retention_days=item["retention_days"],
            date_added=datetime.fromisoformat(item["timestamp"]),
            file_id=None,
        )
        for item in response["data"]
    ]


# BLOB DOWNLOAD BEHAVIOR.


def download_segments(segments: List[RecordingSegmentStorageMeta]) -> Iterator[bytes]:
    """Download segment data from remote storage."""

    # start a sentry transaction to pass to the thread pool workers
    transaction = sentry_sdk.start_transaction(
        op="http.server",
        name="ProjectReplayRecordingSegmentIndexEndpoint.download_segments",
        sampled=True,
    )

    download_segment_with_fixed_args = functools.partial(
        download_segment, transaction=transaction, current_hub=sentry_sdk.Hub.current
    )

    yield b"["
    # Map all of the segments to a worker process for download.
    with ThreadPoolExecutor(max_workers=10) as exe:
        results = exe.map(download_segment_with_fixed_args, segments)

        for i, result in enumerate(results):
            if result is None:
                yield b"[]"
            else:
                yield result

            if i < len(segments) - 1:
                yield b","
    yield b"]"
    transaction.finish()


def download_segment(
    segment: RecordingSegmentStorageMeta,
    transaction: Span,
    current_hub: sentry_sdk.Hub,
) -> Optional[bytes]:
    """Return the segment blob data."""
    with sentry_sdk.Hub(current_hub):
        with transaction.start_child(
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


# Read segment data from a byte range.


def find_fileparts(replay_id: str, limit: int, offset: int) -> List[FilePartModel]:
    """Return a list of fileparts."""
    return FilePartModel.objects.filter(key__startswith=replay_id).all()[offset : limit + offset]


def find_filepart(replay_id: str, segment_id: int) -> Optional[FilePartModel]:
    """Return a filepart instance if it can be found."""
    key = f"{replay_id}{segment_id}"
    return FilePartModel.objects.filter(key=key).first()


def download_filepart(filepart: FilePartModel) -> bytes:
    """Return all of the bytes contained within a filepart."""
    store = get_storage(storage._make_storage_options())
    result = store.read_range(filepart.filename, filepart.start, filepart.end)

    # The blob-range is not guaranteed to be encrypted. If the row contains a value in the DEK
    # column then we know we need to decrypt the file before returning it to the user.
    if filepart.dek:
        # KEK is hard-coded for now as an environment variable. This could be managed by a key
        # management service.
        kek = settings.REPLAYS_KEK
        dek = base64.b64decode(filepart.dek)
        return decompress(envelope_decrypt(kek, dek, result))
    else:
        return decompress(result)


def delete_filepart(filepart: FilePartModel) -> bytes:
    """Delete all references to the filepart.

    This function will work regardless of whether the filepart is encrypted or not. The range
    considers the length of the encrypted output. The replaced bytes do not need to be encrypted
    because the metadata row will not exist at the end of this operation.
    """
    # Store the values necessary to delete the byte-range from the filepart.
    filename = filepart.filename
    start = filepart.start
    end = filepart.end

    # Eagerly delete the filepart from the database. This prevents concurrent access between the
    # successful zeroing of the range and the deletion of the row.
    filepart.delete()

    # Objects in the blob storage service are immutable.  The blob is downloaded in full.
    store = get_storage(storage._make_storage_options())
    blob = store.get(filename)

    # Replace the bytes within the filepart model's range with null bytes. The length is the
    # difference of the start and end byte plus one. We add one to make the range inclusive.
    new_blob = _overwrite_range(blob, start=start, length=end - start + 1)

    # Push blob-data to a filepath that already exists causes it to be overwritten. This operation
    # resets the TTL.
    store.save(filename, new_blob)


def _overwrite_range(blob_data: bytes, start: int, length: int) -> io.BytesIO:
    """Replace every byte within a contiguous range with null bytes."""
    blob_data = io.BytesIO(blob_data)
    blob_data.seek(start)
    blob_data.write(b"\x00" * length)
    blob_data.seek(0)
    return blob_data
