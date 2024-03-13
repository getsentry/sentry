from __future__ import annotations

import dataclasses
import logging
import zlib
from datetime import datetime, timezone
from typing import TypedDict, cast

from sentry_kafka_schemas.schema_types.ingest_replay_recordings_v1 import ReplayRecording
from sentry_sdk import Hub, set_tag
from sentry_sdk.tracing import Span

from sentry.constants import DataCategory
from sentry.models.project import Project
from sentry.replays.lib.storage import (
    RecordingSegmentStorageMeta,
    make_recording_filename,
    make_video_filename,
    storage_kv,
)
from sentry.replays.usecases.ingest.dom_index import log_canvas_size, parse_and_emit_replay_actions
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


class RecordingSegmentMessage(TypedDict):
    retention_days: int
    org_id: int
    project_id: int
    replay_id: str  # the uuid of the encompassing replay event
    key_id: int | None
    received: int
    replay_recording: ReplayRecordingSegment


class MissingRecordingSegmentHeaders(ValueError):
    pass


@dataclasses.dataclass
class RecordingIngestMessage:
    retention_days: int
    org_id: int
    project_id: int
    replay_id: str
    key_id: int | None
    received: int
    payload_with_headers: bytes
    replay_event: bytes | None
    replay_video: bytes | None


@metrics.wraps("replays.usecases.ingest.ingest_recording")
def ingest_recording(message_dict: ReplayRecording, transaction: Span, current_hub: Hub) -> None:
    """Ingest non-chunked recording messages."""
    with current_hub:
        with transaction.start_child(
            op="replays.usecases.ingest.ingest_recording",
            description="ingest_recording",
        ):
            message = RecordingIngestMessage(
                replay_id=message_dict["replay_id"],
                key_id=message_dict.get("key_id"),
                org_id=message_dict["org_id"],
                project_id=message_dict["project_id"],
                received=message_dict["received"],
                retention_days=message_dict["retention_days"],
                payload_with_headers=cast(bytes, message_dict["payload"]),
                replay_event=cast(bytes | None, message_dict.get("replay_event")),
                replay_video=cast(bytes | None, message_dict.get("replay_video")),
            )
            _ingest_recording(message, transaction)


def _ingest_recording(message: RecordingIngestMessage, transaction: Span) -> None:
    """Ingest recording messages."""
    set_tag("org_id", message.org_id)
    set_tag("project_id", message.project_id)

    try:
        headers, recording_segment = process_headers(message.payload_with_headers)
    except Exception:
        # TODO: DLQ
        logger.exception("Recording headers could not be extracted %s", message.replay_id)
        return None

    # Normalize ingest data into a standardized ingest format.
    segment_data = RecordingSegmentStorageMeta(
        project_id=message.project_id,
        replay_id=message.replay_id,
        segment_id=headers["segment_id"],
        retention_days=message.retention_days,
    )

    # Using a blob driver ingest the recording-segment bytes.  The storage location is unknown
    # within this scope.
    storage_kv.set(make_recording_filename(segment_data), recording_segment)

    if message.replay_video:
        # Record video size for COGS analysis.
        metrics.distribution(
            "replays.recording_consumer.replay_video_size",
            len(message.replay_video),
            unit="byte",
        )
        storage_kv.set(make_video_filename(segment_data), message.replay_video)

    recording_post_processor(message, headers, recording_segment, message.replay_event, transaction)

    # The first segment records an accepted outcome. This is for billing purposes. Subsequent
    # segments are not billed.
    if headers["segment_id"] == 0 and message.replay_video is None:
        track_initial_segment_event(
            message.org_id,
            message.project_id,
            message.replay_id,
            message.key_id,
            message.received,
        )

    transaction.finish()


def track_initial_segment_event(
    org_id: int,
    project_id: int,
    replay_id,
    key_id: int | None,
    received: int,
) -> None:
    try:
        project = Project.objects.get_from_cache(id=project_id)
    except Project.DoesNotExist:
        logger.warning(
            "Recording segment was received for a project that does not exist.",
            extra={
                "project_id": project_id,
                "replay_id": replay_id,
            },
        )
        return None

    if not project.flags.has_replays:
        logger.info(
            "Sending first_replay_received signal",
            extra={
                "project_id": project_id,
                "org_id": org_id,
                "replay_id": replay_id,
                "key_id": key_id,
                "project_details": repr(project),
            },
        )
        first_replay_received.send_robust(project=project, sender=Project)

    track_outcome(
        org_id=org_id,
        project_id=project_id,
        key_id=key_id,
        outcome=Outcome.ACCEPTED,
        reason=None,
        timestamp=datetime.fromtimestamp(received, timezone.utc),
        event_id=replay_id,
        category=DataCategory.REPLAY,
        quantity=1,
    )


@metrics.wraps("replays.usecases.ingest.process_headers")
def process_headers(bytes_with_headers: bytes) -> tuple[RecordingSegmentHeaders, bytes]:
    recording_headers_json, recording_segment = bytes_with_headers.split(b"\n", 1)
    recording_headers = json.loads(recording_headers_json)
    assert isinstance(recording_headers.get("segment_id"), int)
    return recording_headers, recording_segment


def replay_recording_segment_cache_id(project_id: int, replay_id: str, segment_id: str) -> str:
    return f"{project_id}:{replay_id}:{segment_id}"


def decompress(data: bytes) -> bytes:
    """Return decompressed bytes."""
    if data.startswith(b"["):
        return data
    else:
        return zlib.decompress(data, zlib.MAX_WBITS | 32)


def _report_size_metrics(
    size_compressed: int | None = None, size_uncompressed: int | None = None
) -> None:
    if size_compressed:
        metrics.distribution(
            "replays.usecases.ingest.size_compressed", size_compressed, unit="byte"
        )
    if size_uncompressed:
        metrics.distribution(
            "replays.usecases.ingest.size_uncompressed", size_uncompressed, unit="byte"
        )


def recording_post_processor(
    message: RecordingIngestMessage,
    headers: RecordingSegmentHeaders,
    segment_bytes: bytes,
    replay_event_bytes: bytes | None,
    transaction: Span,
) -> None:
    try:
        with metrics.timer("replays.usecases.ingest.decompress_and_parse"):
            decompressed_segment = decompress(segment_bytes)
            parsed_segment_data = json.loads(decompressed_segment)
            parsed_replay_event = json.loads(replay_event_bytes) if replay_event_bytes else None
            _report_size_metrics(len(segment_bytes), len(decompressed_segment))

        # Emit DOM search metadata to Clickhouse.
        with transaction.start_child(
            op="replays.usecases.ingest.parse_and_emit_replay_actions",
            description="parse_and_emit_replay_actions",
        ):
            parse_and_emit_replay_actions(
                retention_days=message.retention_days,
                project_id=message.project_id,
                replay_id=message.replay_id,
                segment_data=parsed_segment_data,
                replay_event=parsed_replay_event,
            )

        # Log canvas mutations to bigquery.
        log_canvas_size(
            message.org_id,
            message.project_id,
            message.replay_id,
            parsed_segment_data,
        )
    except Exception:
        logging.exception(
            "Failed to parse recording org=%s, project=%s, replay=%s, segment=%s",
            message.org_id,
            message.project_id,
            message.replay_id,
            headers["segment_id"],
        )
