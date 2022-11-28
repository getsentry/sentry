from __future__ import annotations

import dataclasses
import logging
from datetime import datetime, timezone
from io import BytesIO
from typing import TypedDict

import sentry_sdk
from django.conf import settings
from django.db.utils import IntegrityError
from sentry_sdk.tracing import Transaction

from sentry.constants import DataCategory
from sentry.models import File
from sentry.models.project import Project
from sentry.replays.cache import RecordingSegmentCache, RecordingSegmentParts
from sentry.replays.models import ReplayRecordingSegment as ReplayRecordingSegmentModel
from sentry.signals import first_replay_received
from sentry.utils import json, metrics
from sentry.utils.outcomes import Outcome, track_outcome

logger = logging.getLogger("sentry.replays")

CACHE_TIMEOUT = 3600
COMMIT_FREQUENCY_SEC = 1


class ReplayRecordingSegment(TypedDict):
    id: str  # a uuid that individualy identifies a recording segment
    chunks: int  # the number of chunks for this segment


class RecordingSegmentHeaders(TypedDict):
    segment_id: int


class RecordingSegmentChunkMessage(TypedDict):
    id: str  # a uuid that individualy identifies a recording segment
    replay_id: str  # the uuid of the encompassing replay event
    project_id: int
    chunk_index: int  # each segment is split into chunks to fit into kafka
    payload: bytes


class RecordingSegmentMessage(TypedDict):
    replay_id: str  # the uuid of the encompassing replay event
    org_id: int
    project_id: int
    key_id: int | None
    received: int
    replay_recording: ReplayRecordingSegment


class RecordingMessage(TypedDict):
    replay_id: str
    key_id: int | None
    org_id: int
    project_id: int
    received: int
    payload: bytes


class MissingRecordingSegmentHeaders(ValueError):
    pass


@dataclasses.dataclass
class RecordingIngestMessage:
    replay_id: str
    key_id: int | None
    org_id: int | None
    received: int
    project_id: int
    payload_with_headers: bytes


@metrics.wraps("replays.usecases.ingest.ingest_recording_chunked")
def ingest_recording_chunked(
    message_dict: RecordingSegmentMessage,
    parts: RecordingSegmentParts,
    transaction: Transaction,
) -> None:
    """Ingest chunked recording messages."""
    with transaction.start_child(
        op="replays.usecases.ingest.ingest_recording_chunked",
        description="ingest_recording_chunked",
    ):
        try:
            recording_segment_with_headers = collate_segment_chunks(parts)
        except ValueError:
            logger.exception("Missing recording-segment.")
            return None

        message = RecordingIngestMessage(
            replay_id=message_dict["replay_id"],
            key_id=message_dict.get("key_id"),
            org_id=message_dict.get("org_id"),
            project_id=message_dict["project_id"],
            received=message_dict["received"],
            payload_with_headers=recording_segment_with_headers,
        )
        ingest_recording(message, transaction)

        # Segment chunks are always deleted if ingest behavior runs without error.
        with metrics.timer("replays.process_recording.store_recording.drop_segments"):
            parts.drop()


@metrics.wraps("replays.usecases.ingest.ingest_recording_not_chunked")
def ingest_recording_not_chunked(message_dict: RecordingMessage, transaction: Transaction) -> None:
    """Ingest non-chunked recording messages."""
    with transaction.start_child(
        op="replays.usecases.ingest.ingest_recording_not_chunked",
        description="ingest_recording_not_chunked",
    ):
        message = RecordingIngestMessage(
            replay_id=message_dict["replay_id"],
            key_id=message_dict.get("key_id"),
            org_id=message_dict.get("org_id"),
            project_id=message_dict["project_id"],
            received=message_dict["received"],
            payload_with_headers=message_dict["payload"],
        )
        ingest_recording(message, transaction)


def ingest_recording(message: RecordingIngestMessage, transaction: Transaction) -> None:
    """Ingest recording messages."""
    try:
        headers, recording_segment = process_headers(message.payload_with_headers)
    except MissingRecordingSegmentHeaders:
        logger.warning(f"missing header on {message.replay_id}")
        return None

    with metrics.timer("replays.process_recording.store_recording.count_segments"):
        count_existing_segments = ReplayRecordingSegmentModel.objects.filter(
            replay_id=message.replay_id,
            project_id=message.project_id,
            segment_id=headers["segment_id"],
        ).count()

    if count_existing_segments > 0:
        with sentry_sdk.push_scope() as scope:
            scope.level = "warning"
            scope.add_attachment(bytes=recording_segment, filename="dup_replay_segment")
            scope.set_tag("replay_id", message.replay_id)
            scope.set_tag("project_id", message.project_id)

            logging.exception("Recording segment was already processed.")

        return None

    # create a File for our recording segment.
    recording_segment_file_name = f"rr:{message.replay_id}:{headers['segment_id']}"
    with metrics.timer("replays.store_recording.store_recording.create_file"):
        file = File.objects.create(
            name=recording_segment_file_name,
            type="replay.recording",
        )
    with metrics.timer("replays.store_recording.store_recording.put_segment_file"):
        file.putfile(
            BytesIO(recording_segment),
            blob_size=settings.SENTRY_ATTACHMENT_BLOB_SIZE,
        )

    try:
        # associate this file with an indexable replay_id via ReplayRecordingSegmentModel
        with metrics.timer("replays.store_recording.store_recording.create_segment_row"):
            ReplayRecordingSegmentModel.objects.create(
                replay_id=message.replay_id,
                project_id=message.project_id,
                segment_id=headers["segment_id"],
                file_id=file.id,
                size=len(recording_segment),
            )
    except IntegrityError:
        # Raised in the event of a concurrent write.  Reasonably space
        logger.warning(
            "Recording-segment has already been processed.",
            extra={
                "replay_id": message.replay_id,
                "project_id": message.project_id,
                "segment_id": headers["segment_id"],
            },
        )

        # Cleanup the blob.
        file.delete()

    # TODO: how to handle failures in the above calls. what should happen?
    # also: handling same message twice?

    # TODO: in join wait for outcomes producer to flush possibly,
    # or do this in a separate arroyo step
    # also need to talk with other teams on only-once produce requirements
    if headers["segment_id"] == 0 and message.org_id:
        project = Project.objects.get_from_cache(id=message.project_id)
        if not project.flags.has_replays:
            first_replay_received.send_robust(project=project, sender=Project)

        track_outcome(
            org_id=message.org_id,
            project_id=message.project_id,
            key_id=message.key_id,
            outcome=Outcome.ACCEPTED,
            reason=None,
            timestamp=datetime.utcfromtimestamp(message.received).replace(tzinfo=timezone.utc),
            event_id=message.replay_id,
            category=DataCategory.REPLAY,
            quantity=1,
        )

    transaction.finish()


@metrics.wraps("replays.usecases.ingest.ingest_chunk")
def ingest_chunk(message_dict: RecordingSegmentChunkMessage, transaction: Transaction) -> None:
    """Ingest chunked message part."""
    with transaction.start_child(op="replays.process_recording.store_chunk"):
        cache_prefix = replay_recording_segment_cache_id(
            project_id=message_dict["project_id"],
            replay_id=message_dict["replay_id"],
            segment_id=message_dict["id"],
        )

        part = RecordingSegmentCache(cache_prefix)
        part[message_dict["chunk_index"]] = message_dict["payload"]

    transaction.finish()


@metrics.wraps("replays.usecases.ingest.collate_segment_chunks")
def collate_segment_chunks(chunks: RecordingSegmentParts) -> bytes:
    """Collect and merge recording segment chunks."""
    return b"".join(list(chunks))


@metrics.wraps("replays.usecases.ingest.process_headers")
def process_headers(bytes_with_headers: bytes) -> tuple[RecordingSegmentHeaders, bytes]:
    try:
        recording_headers, recording_segment = bytes_with_headers.split(b"\n", 1)
    except ValueError:
        raise MissingRecordingSegmentHeaders
    else:
        return json.loads(recording_headers), recording_segment


def replay_recording_segment_cache_id(project_id: int, replay_id: str, segment_id: str) -> str:
    return f"{project_id}:{replay_id}:{segment_id}"
