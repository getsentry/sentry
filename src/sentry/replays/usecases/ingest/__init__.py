from __future__ import annotations

import dataclasses
import logging
import zlib
from datetime import datetime, timezone
from typing import Any, TypedDict, cast

import sentry_sdk
import sentry_sdk.scope
from django.conf import settings
from sentry_kafka_schemas.codecs import Codec, ValidationError
from sentry_kafka_schemas.schema_types.ingest_replay_recordings_v1 import ReplayRecording
from sentry_sdk import set_tag

from sentry import options
from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.constants import DataCategory
from sentry.logging.handlers import SamplingFilter
from sentry.models.project import Project
from sentry.replays.lib.storage import (
    RecordingSegmentStorageMeta,
    make_recording_filename,
    storage_kv,
)
from sentry.replays.usecases.ingest.dom_index import ReplayActionsEvent, emit_replay_actions
from sentry.replays.usecases.ingest.dom_index import log_canvas_size as log_canvas_size_old
from sentry.replays.usecases.ingest.dom_index import parse_replay_actions
from sentry.replays.usecases.ingest.event_logger import (
    emit_request_response_metrics,
    log_canvas_size,
    log_mutation_events,
    log_option_events,
    report_hydration_error,
    report_rage_click,
)
from sentry.replays.usecases.ingest.event_parser import ParsedEventMeta, parse_events
from sentry.replays.usecases.pack import pack
from sentry.signals import first_replay_received
from sentry.utils import json, metrics
from sentry.utils.outcomes import Outcome, track_outcome

CACHE_TIMEOUT = 3600
COMMIT_FREQUENCY_SEC = 1
LOG_SAMPLE_RATE = 0.01
RECORDINGS_CODEC: Codec[ReplayRecording] = get_topic_codec(Topic.INGEST_REPLAYS_RECORDINGS)

logger = logging.getLogger("sentry.replays")
logger.addFilter(SamplingFilter(LOG_SAMPLE_RATE))


class DropSilently(Exception):
    pass


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


def ingest_recording(message_bytes: bytes) -> None:
    """Ingest non-chunked recording messages."""
    isolation_scope = sentry_sdk.Scope.get_isolation_scope().fork()

    with sentry_sdk.scope.use_isolation_scope(isolation_scope):
        with sentry_sdk.start_transaction(
            name="replays.consumer.process_recording",
            op="replays.consumer",
            custom_sampling_context={
                "sample_rate": getattr(
                    settings, "SENTRY_REPLAY_RECORDINGS_CONSUMER_APM_SAMPLING", 0
                )
            },
        ):
            try:
                message = parse_recording_message(message_bytes)
                if message.org_id in options.get("replay.consumer.separate-compute-and-io-org-ids"):
                    _ingest_recording_separated_io_compute(message)
                else:
                    _ingest_recording(message)
            except DropSilently:
                # The message couldn't be parsed for whatever reason. We shouldn't block the consumer
                # so we ignore it.
                pass


@sentry_sdk.trace
def _ingest_recording(message: RecordingIngestMessage) -> None:
    """Ingest recording messages."""
    set_tag("org_id", message.org_id)
    set_tag("project_id", message.project_id)

    headers, segment_bytes = parse_headers(message.payload_with_headers, message.replay_id)
    segment = decompress_segment(segment_bytes)
    _report_size_metrics(len(segment.compressed), len(segment.decompressed))

    # Normalize ingest data into a standardized ingest format.
    segment_data = RecordingSegmentStorageMeta(
        project_id=message.project_id,
        replay_id=message.replay_id,
        segment_id=headers["segment_id"],
        retention_days=message.retention_days,
    )

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

        dat = zlib.compress(pack(rrweb=segment.decompressed, video=message.replay_video))
        storage_kv.set(make_recording_filename(segment_data), dat)

        # Track combined payload size.
        metrics.distribution(
            "replays.recording_consumer.replay_video_event_size", len(dat), unit="byte"
        )
    else:
        storage_kv.set(make_recording_filename(segment_data), segment.compressed)

    recording_post_processor(message, headers, segment.decompressed, message.replay_event)

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


@sentry_sdk.trace
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
        return _track_initial_segment_event(
            org_id, project, replay_id, key_id, received, is_replay_video
        )
    except Project.DoesNotExist:
        logger.warning(
            "Recording segment was received for a project that does not exist.",
            extra={
                "project_id": project_id,
                "replay_id": replay_id,
            },
        )
        return None


def _track_initial_segment_event(
    org_id: int,
    project: Project,
    replay_id,
    key_id: int | None,
    received: int,
    is_replay_video: bool,
) -> None:
    if not project.flags.has_replays:
        first_replay_received.send_robust(project=project, sender=Project)

    # Beta customers will have a 2 months grace period post GA.
    if should_skip_billing(org_id, is_replay_video):
        metrics.incr("replays.billing-outcome-skipped")
        track_outcome(
            org_id=org_id,
            project_id=project.id,
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
            project_id=project.id,
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


@sentry_sdk.trace
def recording_post_processor(
    message: RecordingIngestMessage,
    headers: RecordingSegmentHeaders,
    segment_bytes: bytes,
    replay_event_bytes: bytes | None,
) -> None:
    try:
        segment, replay_event = parse_segment_and_replay_data(segment_bytes, replay_event_bytes)

        # Conditionally use the new separated event parsing and logging logic. This way we can
        # feature flag access and fix any issues we find.
        if message.org_id in options.get("replay.consumer.separate-compute-and-io-org-ids"):
            event_meta = parse_events(segment)
            project = Project.objects.get_from_cache(id=message.project_id)
            emit_replay_events(
                event_meta,
                message.org_id,
                project,
                message.replay_id,
                replay_event,
            )
        else:
            actions_event = try_get_replay_actions(message, segment, replay_event)
            if actions_event:
                emit_replay_actions(actions_event)

            # Log canvas mutations to bigquery.
            log_canvas_size_old(
                message.org_id,
                message.project_id,
                message.replay_id,
                segment,
            )

            # Log # of rrweb events to bigquery.
            logger.info(
                "sentry.replays.slow_click",
                extra={
                    "event_type": "rrweb_event_count",
                    "org_id": message.org_id,
                    "project_id": message.project_id,
                    "replay_id": message.replay_id,
                    "size": len(segment),
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


@sentry_sdk.trace
def parse_recording_message(message: bytes) -> RecordingIngestMessage:
    try:
        message_dict: ReplayRecording = RECORDINGS_CODEC.decode(message)
    except ValidationError:
        logger.exception("Could not decode recording message.")
        raise DropSilently()

    return RecordingIngestMessage(
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


@sentry_sdk.trace
def parse_headers(recording: bytes, replay_id: str) -> tuple[RecordingSegmentHeaders, bytes]:
    try:
        recording_headers_json, recording_segment = recording.split(b"\n", 1)
        recording_headers = json.loads(recording_headers_json)
        assert isinstance(recording_headers.get("segment_id"), int)
        return recording_headers, recording_segment
    except Exception:
        logger.exception("Recording headers could not be extracted %s", replay_id)
        raise DropSilently()


@dataclasses.dataclass(frozen=True)
class Segment:
    compressed: bytes
    decompressed: bytes


@sentry_sdk.trace
def decompress_segment(segment: bytes) -> Segment:
    try:
        decompressed_segment = zlib.decompress(segment)
        return Segment(segment, decompressed_segment)
    except zlib.error:
        if segment[0] == ord("["):
            compressed_segment = zlib.compress(segment)
            return Segment(compressed_segment, segment)
        else:
            logger.exception("Invalid recording body.")
            raise DropSilently()


@sentry_sdk.trace
def parse_segment_and_replay_data(segment: bytes, replay_event: bytes | None) -> tuple[Any, Any]:
    parsed_segment_data = json.loads(segment)
    parsed_replay_event = json.loads(replay_event) if replay_event else None
    return parsed_segment_data, parsed_replay_event


@sentry_sdk.trace
def try_get_replay_actions(
    message: RecordingIngestMessage,
    parsed_segment_data: Any,
    parsed_replay_event: Any | None,
) -> ReplayActionsEvent | None:
    project = Project.objects.get_from_cache(id=message.project_id)

    return parse_replay_actions(
        project=project,
        replay_id=message.replay_id,
        retention_days=message.retention_days,
        segment_data=parsed_segment_data,
        replay_event=parsed_replay_event,
        org_id=message.org_id,
    )


@sentry_sdk.trace
def emit_replay_events(
    event_meta: ParsedEventMeta,
    org_id: int,
    project: Project,
    replay_id: str,
    replay_event: dict[str, Any] | None,
) -> None:
    emit_request_response_metrics(event_meta)
    log_canvas_size(event_meta, org_id, project.id, replay_id)
    log_mutation_events(event_meta, project.id, replay_id)
    log_option_events(event_meta, project.id, replay_id)
    report_hydration_error(event_meta, project, replay_id, replay_event)
    report_rage_click(event_meta, project, replay_id, replay_event)


# Separated I/O and compute branch.


class CouldNotFindProject(DropSilently):
    pass


@sentry_sdk.trace
def _ingest_recording_separated_io_compute(message: RecordingIngestMessage) -> None:
    """Ingest recording messages."""
    processed_recording = process_recording_message(message)
    commit_recording_message(processed_recording)
    track_recording_metadata(processed_recording)


@dataclasses.dataclass
class ProcessedRecordingMessage:
    actions_event: ParsedEventMeta | None
    filedata: bytes
    filename: str
    is_replay_video: bool
    key_id: int | None
    org_id: int
    project_id: int
    received: int
    recording_size_uncompressed: int
    recording_size: int
    replay_event: dict[str, Any] | None
    replay_id: str
    segment_id: int
    video_size: int | None


@sentry_sdk.trace
def process_recording_message(message: RecordingIngestMessage) -> ProcessedRecordingMessage:
    set_tag("org_id", message.org_id)
    set_tag("project_id", message.project_id)

    headers, segment_bytes = parse_headers(message.payload_with_headers, message.replay_id)
    segment = decompress_segment(segment_bytes)

    replay_events = parse_replay_events(message, headers, segment.decompressed)

    with sentry_sdk.start_span(name="Parse replay event"):
        replay_event = json.loads(message.replay_event) if message.replay_event else None

    filename = make_recording_filename(
        RecordingSegmentStorageMeta(
            project_id=message.project_id,
            replay_id=message.replay_id,
            segment_id=headers["segment_id"],
            retention_days=message.retention_days,
        )
    )

    if message.replay_video:
        with sentry_sdk.start_span(name="Compress video event"):
            filedata = zlib.compress(pack(rrweb=segment.decompressed, video=message.replay_video))
        video_size = len(message.replay_video)
    else:
        filedata = segment.compressed
        video_size = None

    return ProcessedRecordingMessage(
        replay_events,
        filedata,
        filename,
        is_replay_video=message.replay_video is not None,
        key_id=message.key_id,
        org_id=message.org_id,
        project_id=message.project_id,
        received=message.received,
        recording_size_uncompressed=len(segment.decompressed),
        recording_size=len(segment.compressed),
        replay_event=replay_event,
        replay_id=message.replay_id,
        segment_id=headers["segment_id"],
        video_size=video_size,
    )


@sentry_sdk.trace
def commit_recording_message(recording: ProcessedRecordingMessage) -> None:
    # Write to GCS.
    storage_kv.set(recording.filename, recording.filedata)

    try:
        project = Project.objects.get_from_cache(id=recording.project_id)
        assert isinstance(project, Project)
    except Project.DoesNotExist:
        logger.warning(
            "Recording segment was received for a project that does not exist.",
            extra={
                "project_id": recording.project_id,
                "replay_id": recording.replay_id,
            },
        )
        raise CouldNotFindProject()

    # Write to billing consumer if its a billable event.
    if recording.segment_id == 0:
        _track_initial_segment_event(
            recording.org_id,
            project,
            recording.replay_id,
            recording.key_id,
            recording.received,
            is_replay_video=recording.is_replay_video,
        )

    # Write to replay-event consumer.
    if recording.actions_event:
        emit_replay_events(
            recording.actions_event,
            recording.org_id,
            project,
            recording.replay_id,
            recording.replay_event,
        )


@sentry_sdk.trace
def track_recording_metadata(recording: ProcessedRecordingMessage) -> None:
    # Report size metrics to determine usage patterns.
    _report_size_metrics(
        size_compressed=recording.recording_size,
        size_uncompressed=recording.recording_size_uncompressed,
    )

    if recording.video_size:
        # Logging org info for bigquery
        logger.info(
            "sentry.replays.slow_click",
            extra={
                "event_type": "mobile_event",
                "org_id": recording.org_id,
                "project_id": recording.project_id,
                "size": len(recording.filedata),
            },
        )

        # Track the number of replay-video events we receive.
        metrics.incr("replays.recording_consumer.replay_video_count")

        # Record video size for COGS analysis.
        metrics.distribution(
            "replays.recording_consumer.replay_video_size",
            recording.video_size,
            unit="byte",
        )

        # Track combined payload size for COGs analysis.
        metrics.distribution(
            "replays.recording_consumer.replay_video_event_size",
            len(recording.filedata),
            unit="byte",
        )


def parse_replay_events(
    message: RecordingIngestMessage, headers: RecordingSegmentHeaders, segment_bytes: bytes
) -> ParsedEventMeta | None:
    try:
        return parse_events(json.loads(segment_bytes))
    except Exception:
        logging.exception(
            "Failed to parse recording org=%s, project=%s, replay=%s, segment=%s",
            message.org_id,
            message.project_id,
            message.replay_id,
            headers["segment_id"],
        )
        return None
