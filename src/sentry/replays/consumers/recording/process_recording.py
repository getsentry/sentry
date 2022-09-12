from __future__ import annotations

import dataclasses
import logging
import zlib
from io import BytesIO
from typing import Dict, Generator, List, Sequence, Union

import msgpack
from confluent_kafka import Message
from django.conf import settings

from sentry.models import File
from sentry.replays.consumers.recording.types import RecordingSegmentHeaders
from sentry.replays.models import ReplayRecordingSegment
from sentry.utils import json
from sentry.utils.batching_kafka_consumer import AbstractBatchWorker, BatchingKafkaConsumer
from sentry.utils.kafka import create_batching_kafka_consumer

logger = logging.getLogger("sentry.replays")

CACHE_TIMEOUT = 3600


class MissingRecordingSegmentHeaders(ValueError):
    pass


@dataclasses.dataclass
class ReplayRecordingSegmentRaw:
    project_id: int
    replay_id: str
    segment_id: str
    count_chunks: int


@dataclasses.dataclass
class ReplayRecordingSegmentChunk:
    cache_key: str
    payload: bytes


def get_replay_recording_consumer(
    topic: str,
    **options: Dict[str, str],
) -> BatchingKafkaConsumer:
    return create_batching_kafka_consumer(
        {topic},
        worker=ReplayRecordingBatchWorker(),
        **options,
    )


class ReplayRecordingBatchWorker(AbstractBatchWorker):
    """Replay Recording Batch Worker."""

    def process_message(self, message: Message) -> None:
        """Unpack and process the received message."""
        result = msgpack.unpackb(message.value(), use_list=False)

        if result["type"] == "replay_recording_chunk":
            return process_chunk(result)
        elif result["type"] == "replay_recording":
            return process_recording(result)
        else:
            return None

    def flush_batch(
        self,
        results: List[Union[ReplayRecordingSegmentRaw, ReplayRecordingSegmentChunk]],
    ) -> None:
        """Flush batched results."""
        chunks = filter(lambda r: isinstance(r, ReplayRecordingSegmentChunk), results)
        flush_chunks(chunks)

        recordings = filter(lambda r: isinstance(r, ReplayRecordingSegmentRaw), results)
        [flush_recording(recording) for recording in recordings]


def process_chunk(result: dict) -> ReplayRecordingSegmentChunk:
    """Process a "replay_recording_chunk" message type."""
    return ReplayRecordingSegmentChunk(make_cache_key(result), zlib.compress(result["payload"]))


def process_recording(result: dict) -> ReplayRecordingSegmentRaw:
    """Process a "replay_recording" message type."""
    return ReplayRecordingSegmentRaw(
        project_id=result["project_id"],
        replay_id=result["replay_id"],
        segment_id=result["replay_recording"]["id"],
        count_chunks=result["replay_recording"]["chunks"],
    )


def flush_chunks(chunks: Sequence[ReplayRecordingSegmentChunk]) -> None:
    """Flush chunks to Redis."""
    # TODO
    # cache.mset({chunk.cache_key: chunk.payload for chunk in chunks})
    pass


def flush_recording(recording: ReplayRecordingSegmentRaw) -> None:
    """Process a "replay_recording" message type.

    Chunks are fetched from Redis, merged, and uploaded to permanent blob storage.
    pass
    """
    # TODO
    # Get the cache keys. Needed for fetch and delete.
    # cache_keys = list(iter_cache_prefixes(recording))

    # Multi-get all the keys in one request.
    # results = cache.mget(cache_keys)
    results = []

    # Missing chunks force a skip of processing. The message is committed and the replay is
    # non-functional.
    if any(results, lambda result: result is None):
        logger.warning(f"Missing segment chunks for replay: `{recording.replay_id}`.")
        return None

    # Remove headers from the initial segment.
    try:
        _, initial_segment = process_headers(results[0])
    except MissingRecordingSegmentHeaders:
        logger.warning(f"missing header on {recording.replay_id}")
        return None

    # Merge the recording segments into a single blob.
    recording_segment = b"".join([initial_segment] + results[1:])

    # Create a File object for tracking and upload to blob storage.
    file = File.objects.create(
        name=f"rr:{recording.replay_id}:{recording.segment_id}",
        type="replay.recording",
    )
    file.putfile(
        BytesIO(recording_segment),
        blob_size=settings.SENTRY_ATTACHMENT_BLOB_SIZE,
    )

    # associate this file with an indexable replay_id via ReplayRecordingSegment
    ReplayRecordingSegment.objects.create(
        replay_id=recording.replay_id,
        project_id=recording.project_id,
        segment_id=recording.segment_id,
        file_id=file.id,
    )

    # Delete the recording-segment chunks from cache after we've stored it.
    # TODO
    # cache.delete(cache_keys)


def process_headers(recording_segment_with_headers: bytes) -> tuple[RecordingSegmentHeaders, bytes]:
    try:
        # split the recording payload by a newline into the headers and the recording
        recording_headers, recording_segment = recording_segment_with_headers.split(b"\n", 1)
    except ValueError:
        raise MissingRecordingSegmentHeaders

    return json.loads(recording_headers), recording_segment


def iter_cache_prefixes(recording: ReplayRecordingSegmentRaw) -> Generator[None, None, str]:
    """Generate a sequence of cache prefixes."""
    prefix = make_cache_prefix(recording)
    for i in range(recording.count_chunks):
        yield f"{prefix}{i}"


def make_cache_key(result: dict) -> str:
    """Return a replay-segment-chunk cache key."""
    prefix = make_cache_prefix(result["project_id"], result["replay_id"], result["id"])
    return f"{prefix}{result['chunk_index']}"


def make_cache_prefix(project_id: int, replay_id: str, segment_id: str) -> str:
    """Return a replay-segment-chunk cache key without a chunk index."""
    return f"{project_id}:{replay_id}:{segment_id}:"
