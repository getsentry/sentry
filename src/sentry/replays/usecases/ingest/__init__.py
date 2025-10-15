import dataclasses
import logging
import time
import zlib
from datetime import datetime, timezone
from typing import Any, TypedDict

import msgspec
import sentry_sdk
from sentry_protos.snuba.v1.trace_item_pb2 import TraceItem

from sentry.constants import DataCategory
from sentry.logging.handlers import SamplingFilter
from sentry.models.project import Project
from sentry.replays.lib.kafka import publish_replay_event
from sentry.replays.lib.storage import _make_recording_filename, storage_kv
from sentry.replays.usecases.ingest.event_logger import (
    emit_click_events,
    emit_request_response_metrics,
    emit_tap_events,
    emit_trace_items_to_eap,
    log_canvas_size,
    log_multiclick_events,
    log_mutation_events,
    log_option_events,
    log_rage_click_events,
    report_hydration_error,
    report_rage_click,
)
from sentry.replays.usecases.ingest.event_parser import ParsedEventMeta, parse_events
from sentry.replays.usecases.pack import pack
from sentry.signals import first_replay_received
from sentry.utils import json, metrics
from sentry.utils.outcomes import Outcome, track_outcome
from sentry.utils.projectflags import set_project_flag_and_signal

LOG_SAMPLE_RATE = 0.01

logger = logging.getLogger("sentry.replays")
logger.addFilter(SamplingFilter(LOG_SAMPLE_RATE))


# Msgspec allows us to define a schema which we can deserialize the typed JSON into. We can also
# leverage this fact to opportunistically avoid deserialization. This is especially important
# because we have huge JSON types that we don't really care about.


class DomContentLoadedEvent(msgspec.Struct, gc=False, tag_field="type", tag=0):
    pass


class LoadedEvent(msgspec.Struct, gc=False, tag_field="type", tag=1):
    pass


class FullSnapshotEvent(msgspec.Struct, gc=False, tag_field="type", tag=2):
    pass


class IncrementalSnapshotEvent(msgspec.Struct, gc=False, tag_field="type", tag=3):
    pass


class MetaEvent(msgspec.Struct, gc=False, tag_field="type", tag=4):
    pass


class PluginEvent(msgspec.Struct, gc=False, tag_field="type", tag=6):
    pass


# These are the schema definitions we care about.


class CustomEventData(msgspec.Struct, gc=False):
    tag: str
    payload: Any


class CustomEvent(msgspec.Struct, gc=False, tag_field="type", tag=5):
    data: CustomEventData | None = None


RRWebEvent = (
    DomContentLoadedEvent
    | LoadedEvent
    | FullSnapshotEvent
    | IncrementalSnapshotEvent
    | MetaEvent
    | CustomEvent
    | PluginEvent
)


def parse_recording_data(payload: bytes) -> list[dict]:
    try:
        # We're parsing with msgspec (if we can) and then transforming to the type that
        # JSON.loads returns.
        return [
            {"type": 5, "data": {"tag": e.data.tag, "payload": e.data.payload}}
            for e in msgspec.json.decode(payload, type=list[RRWebEvent])
            if isinstance(e, CustomEvent) and e.data is not None
        ]
    except Exception:
        # We're emitting a metric instead of logging in case this thing really fails hard in
        # prod. We don't want a huge volume of logs slowing throughput. If there's a
        # significant volume of this metric we'll test against a broader cohort of data.
        metrics.incr("replays.recording_consumer.msgspec_decode_error")
        return json.loads(payload)


class DropEvent(Exception):
    pass


class EventContext(TypedDict):
    key_id: int | None
    org_id: int
    project_id: int
    received: int
    replay_id: str
    retention_days: int
    segment_id: int
    should_publish_replay_event: bool | None


class Event(TypedDict):
    context: EventContext
    payload_compressed: bytes
    payload: bytes
    replay_event: dict[str, Any] | None
    replay_video: bytes | None


@dataclasses.dataclass
class ProcessedEvent:
    actions_event: ParsedEventMeta | None
    context: EventContext
    filedata: bytes
    filename: str
    recording_size_uncompressed: int
    recording_size: int
    replay_event: dict[str, Any] | None
    trace_items: list[TraceItem]
    video_size: int | None


@sentry_sdk.trace
def process_recording_event(
    message: Event, use_new_recording_parser: bool = False
) -> ProcessedEvent:
    parsed_output = parse_replay_events(message, use_new_recording_parser)
    if parsed_output:
        replay_events, trace_items = parsed_output
    else:
        replay_events = None
        trace_items = []

    filename = _make_recording_filename(
        project_id=message["context"]["project_id"],
        replay_id=message["context"]["replay_id"],
        segment_id=message["context"]["segment_id"],
        retention_days=message["context"]["retention_days"],
    )

    if message["replay_video"]:
        filedata = pack_replay_video(message["payload"], message["replay_video"])
        video_size = len(message["replay_video"])
    else:
        filedata = message["payload_compressed"]
        video_size = None

    return ProcessedEvent(
        actions_event=replay_events,
        context=message["context"],
        filedata=filedata,
        filename=filename,
        recording_size_uncompressed=len(message["payload"]),
        recording_size=len(message["payload_compressed"]),
        replay_event=message["replay_event"],
        trace_items=trace_items,
        video_size=video_size,
    )


def parse_replay_events(message: Event, use_new_recording_parser: bool):
    try:
        if use_new_recording_parser:
            events = parse_recording_data(message["payload"])
        else:
            events = json.loads(message["payload"])

        return parse_events(
            {
                "organization_id": message["context"]["org_id"],
                "project_id": message["context"]["project_id"],
                "received": message["context"]["received"],
                "replay_id": message["context"]["replay_id"],
                "retention_days": message["context"]["retention_days"],
                "segment_id": message["context"]["segment_id"],
                "trace_id": extract_trace_id(message["replay_event"]),
            },
            events,
        )
    except Exception:
        logger.exception(
            "Failed to parse recording org=%s, project=%s, replay=%s, segment=%s",
            message["context"]["org_id"],
            message["context"]["project_id"],
            message["context"]["replay_id"],
            message["context"]["segment_id"],
        )
        return None


def extract_trace_id(replay_event: dict[str, Any] | None) -> str | None:
    """Return the trace-id if only one trace-id was provided."""
    try:
        if replay_event:
            trace_ids = replay_event.get("trace_ids", [])
            return str(trace_ids[0]) if trace_ids and len(trace_ids) == 1 else None
    except Exception:
        pass

    return None


@sentry_sdk.trace
def pack_replay_video(recording: bytes, video: bytes):
    return zlib.compress(pack(rrweb=recording, video=video))


@sentry_sdk.trace
def commit_recording_message(recording: ProcessedEvent) -> None:
    # Write to GCS.
    storage_kv.set(recording.filename, recording.filedata)

    try:
        project = Project.objects.get_from_cache(id=recording.context["project_id"])
        assert isinstance(project, Project)
    except Project.DoesNotExist as exc:
        logger.warning(
            "Recording segment was received for a project that does not exist.",
            extra={
                "project_id": recording.context["project_id"],
                "replay_id": recording.context["replay_id"],
            },
        )
        raise DropEvent("Could not find project.") from exc

    # Write to billing consumer if its a billable event.
    if recording.context["segment_id"] == 0:
        _track_initial_segment_event(
            recording.context["org_id"],
            project,
            recording.context["replay_id"],
            recording.context["key_id"],
            recording.context["received"],
        )

    metrics.incr(
        "replays.should_publish_replay_event",
        tags={"value": recording.context["should_publish_replay_event"]},
    )
    if recording.context["should_publish_replay_event"] and recording.replay_event:
        replay_event_kafka_message = {
            "start_time": recording.context["received"],
            "replay_id": recording.context["replay_id"],
            "project_id": recording.context["project_id"],
            "retention_days": recording.context["retention_days"],
            "payload": recording.replay_event,
        }
        publish_replay_event(json.dumps(replay_event_kafka_message))

    # Write to replay-event consumer.
    if recording.actions_event:
        emit_replay_events(
            recording.actions_event,
            recording.context["org_id"],
            project,
            recording.context["replay_id"],
            recording.context["retention_days"],
            recording.replay_event,
        )

    emit_trace_items_to_eap(recording.trace_items)


@sentry_sdk.trace
def emit_replay_events(
    event_meta: ParsedEventMeta,
    org_id: int,
    project: Project,
    replay_id: str,
    retention_days: int,
    replay_event: dict[str, Any] | None,
) -> None:
    environment = replay_event.get("environment") if replay_event else None

    emit_click_events(
        event_meta.click_events,
        project.id,
        replay_id,
        retention_days,
        start_time=time.time(),
        environment=environment,
    )

    emit_tap_events(
        event_meta.tap_events,
        project.id,
        replay_id,
        retention_days,
        start_time=time.time(),
        environment=environment,
    )
    emit_request_response_metrics(event_meta)
    log_canvas_size(event_meta, org_id, project.id, replay_id)
    log_mutation_events(event_meta, project.id, replay_id)
    log_option_events(event_meta, project.id, replay_id)
    log_multiclick_events(event_meta, project.id, replay_id)
    log_rage_click_events(event_meta, project.id, replay_id)
    report_hydration_error(event_meta, project, replay_id, replay_event)
    report_rage_click(event_meta, project, replay_id, replay_event)


def _track_initial_segment_event(
    org_id: int,
    project: Project,
    replay_id,
    key_id: int | None,
    received: int,
) -> None:
    set_project_flag_and_signal(project, "has_replays", first_replay_received)

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


@sentry_sdk.trace
def track_recording_metadata(recording: ProcessedEvent) -> None:
    # Report size metrics to determine usage patterns.
    metrics.distribution(
        "replays.usecases.ingest.size_compressed", recording.recording_size, unit="byte"
    )
    metrics.distribution(
        "replays.usecases.ingest.size_uncompressed",
        recording.recording_size_uncompressed,
        unit="byte",
    )

    if recording.video_size:
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
