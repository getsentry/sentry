from __future__ import annotations

import dataclasses
import logging
import zlib
from datetime import datetime, timezone
from typing import TypedDict, cast

import sentry_sdk.scope
from sentry_kafka_schemas.schema_types.ingest_replay_recordings_v1 import ReplayRecording
from sentry_sdk import Scope, set_tag
from sentry_sdk.tracing import Span

from sentry import options
from sentry.constants import DataCategory
from sentry.logging.handlers import SamplingFilter
from sentry.models.project import Project
from sentry.replays.lib.storage import (
    RecordingSegmentStorageMeta,
    make_recording_filename,
    storage_kv,
)
from sentry.replays.usecases.ingest.dom_index import log_canvas_size, parse_and_emit_replay_actions
from sentry.replays.usecases.pack import pack
from sentry.signals import first_replay_received
from sentry.utils import json, metrics
from sentry.utils.outcomes import Outcome, track_outcome

CACHE_TIMEOUT = 3600
COMMIT_FREQUENCY_SEC = 1
LOG_SAMPLE_RATE = 0.01

logger = logging.getLogger("sentry.replays")
logger.addFilter(SamplingFilter(LOG_SAMPLE_RATE))


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
def ingest_recording(
    message_dict: ReplayRecording, transaction: Span, isolation_scope: Scope
) -> None:
    """Ingest non-chunked recording messages."""
    with sentry_sdk.scope.use_isolation_scope(isolation_scope):
        with transaction.start_child(
            op="replays.usecases.ingest.ingest_recording",
            name="ingest_recording",
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
        headers, compressed_segment = process_headers(message.payload_with_headers)
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

    # Segment is decompressed for further analysis. Packed format expects
    # concatenated, uncompressed bytes.
    try:
        recording_segment = zlib.decompress(compressed_segment)
        _report_size_metrics(len(compressed_segment), len(recording_segment))
    except zlib.error:
        if compressed_segment[0] == ord("["):
            recording_segment = compressed_segment
            compressed_segment = zlib.compress(compressed_segment)  # Save storage $$$
        else:
            logger.exception("Invalid recording body.")
            return None

    if message.replay_video:
        # Logging org info for bigquery
        logger.info(
            "sentry.replays.slow_click",
            extra={
                "event_type": "mobile_event",
                "org_id": message.org_id,
                "project_id": message.project_id,
                "size": len(message.replay_video),
            },
        )

        # Record video size for COGS analysis.
        metrics.incr("replays.recording_consumer.replay_video_count")
        metrics.distribution(
            "replays.recording_consumer.replay_video_size",
            len(message.replay_video),
            unit="byte",
        )

        dat = zlib.compress(pack(rrweb=recording_segment, video=message.replay_video))
        storage_kv.set(make_recording_filename(segment_data), dat)

        # Track combined payload size.
        metrics.distribution(
            "replays.recording_consumer.replay_video_event_size", len(dat), unit="byte"
        )
    else:
        storage_kv.set(make_recording_filename(segment_data), compressed_segment)

    recording_post_processor(message, headers, recording_segment, message.replay_event, transaction)

    # The first segment records an accepted outcome. This is for billing purposes. Subsequent
    # segments are not billed.
    if headers["segment_id"] == 0:
        track_initial_segment_event(
            message.org_id,
            message.project_id,
            message.replay_id,
            message.key_id,
            message.received,
            is_replay_video=message.replay_video is not None,
        )

    transaction.finish()


def track_initial_segment_event(
    org_id: int,
    project_id: int,
    replay_id,
    key_id: int | None,
    received: int,
    is_replay_video: bool,
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
        first_replay_received.send_robust(project=project, sender=Project)

    # Beta customers will have a 2 months grace period post GA.
    if should_skip_billing(org_id, is_replay_video):
        metrics.incr("replays.billing-outcome-skipped")
        track_outcome(
            org_id=org_id,
            project_id=project_id,
            key_id=key_id,
            outcome=Outcome.ACCEPTED,
            reason=None,
            timestamp=datetime.fromtimestamp(received, timezone.utc),
            event_id=replay_id,
            category=DataCategory.REPLAY_VIDEO,
            quantity=1,
        )
    else:
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


def should_skip_billing(org_id: int, is_replay_video: bool) -> bool:
    return is_replay_video and org_id in options.get("replay.replay-video.billing-skip-org-ids")


@metrics.wraps("replays.usecases.ingest.process_headers")
def process_headers(bytes_with_headers: bytes) -> tuple[RecordingSegmentHeaders, bytes]:
    recording_headers_json, recording_segment = bytes_with_headers.split(b"\n", 1)
    recording_headers = json.loads(recording_headers_json)
    assert isinstance(recording_headers.get("segment_id"), int)
    return recording_headers, recording_segment


def replay_recording_segment_cache_id(project_id: int, replay_id: str, segment_id: str) -> str:
    return f"{project_id}:{replay_id}:{segment_id}"


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
            parsed_segment_data = json.loads(segment_bytes)
            parsed_replay_event = json.loads(replay_event_bytes) if replay_event_bytes else None

        # Emit DOM search metadata to Clickhouse.
        with transaction.start_child(
            op="replays.usecases.ingest.parse_and_emit_replay_actions",
            name="parse_and_emit_replay_actions",
        ):
            project = Project.objects.get_from_cache(id=message.project_id)
            parse_and_emit_replay_actions(
                retention_days=message.retention_days,
                project=project,
                replay_id=message.replay_id,
                segment_data=parsed_segment_data,
                replay_event=parsed_replay_event,
                org_id=message.org_id,
            )

        # Log canvas mutations to bigquery.
        log_canvas_size(
            message.org_id,
            message.project_id,
            message.replay_id,
            parsed_segment_data,
        )

        # Log # of rrweb events to bigquery.
        logger.info(
            "sentry.replays.slow_click",
            extra={
                "event_type": "rrweb_event_count",
                "org_id": message.org_id,
                "project_id": message.project_id,
                "replay_id": message.replay_id,
                "size": len(parsed_segment_data),
            },
        )

    except Exception:
        logging.exception(
            "Failed to parse recording org=%s, project=%s, replay=%s, segment=%s",
            message.org_id,
            message.project_id,
            message.replay_id,
            headers["segment_id"],
        )
