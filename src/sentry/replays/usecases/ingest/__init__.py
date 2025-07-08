import dataclasses
import logging
import time
import zlib
from datetime import datetime, timezone
from typing import Any, TypedDict

import sentry_sdk

from sentry.constants import DataCategory
from sentry.logging.handlers import SamplingFilter
from sentry.models.project import Project
from sentry.replays.lib.storage import _make_recording_filename, storage_kv
from sentry.replays.usecases.ingest.event_logger import (
    emit_click_events,
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
from sentry.utils.projectflags import set_project_flag_and_signal

LOG_SAMPLE_RATE = 0.01

logger = logging.getLogger("sentry.replays")
logger.addFilter(SamplingFilter(LOG_SAMPLE_RATE))


class EventContext(TypedDict):
    key_id: int | None
    org_id: int
    project_id: int
    received: int
    replay_id: str
    retention_days: int
    segment_id: int


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
    video_size: int | None


@sentry_sdk.trace
def process_recording_event(message: Event) -> ProcessedEvent:
    replay_events = parse_replay_events(message)

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
        video_size=video_size,
    )


def parse_replay_events(message: Event) -> ParsedEventMeta | None:
    try:
        return parse_events(json.loads(message["payload"]))
    except Exception:
        logger.exception(
            "Failed to parse recording org=%s, project=%s, replay=%s, segment=%s",
            message["context"]["org_id"],
            message["context"]["project_id"],
            message["context"]["replay_id"],
            message["context"]["segment_id"],
        )
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
    except Project.DoesNotExist:
        logger.warning(
            "Recording segment was received for a project that does not exist.",
            extra={
                "project_id": recording.context["project_id"],
                "replay_id": recording.context["replay_id"],
            },
        )
        return None

    # Write to billing consumer if its a billable event.
    if recording.context["segment_id"] == 0:
        _track_initial_segment_event(
            recording.context["org_id"],
            project,
            recording.context["replay_id"],
            recording.context["key_id"],
            recording.context["received"],
        )

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


@sentry_sdk.trace
def emit_replay_events(
    event_meta: ParsedEventMeta,
    org_id: int,
    project: Project,
    replay_id: str,
    retention_days: int,
    replay_event: dict[str, Any] | None,
) -> None:
    environment = None
    if replay_event and replay_event.get("payload"):
        payload = replay_event["payload"]
        if isinstance(payload, dict):
            environment = payload.get("environment")
        else:
            environment = json.loads(bytes(payload)).get("environment")

    emit_click_events(
        event_meta.click_events,
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
