from __future__ import annotations

import concurrent.futures as cf
import time
import uuid
from typing import Any

from sentry.replays.lib.kafka import initialize_replays_publisher
from sentry.replays.lib.storage import filestore, storage
from sentry.replays.models import ReplayRecordingSegment
from sentry.replays.usecases.reader import fetch_segments_metadata
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.utils import json, metrics


@instrumented_task(
    name="sentry.replays.tasks.delete_recording_segments",
    queue="replays.delete_replay",
    default_retry_delay=5,
    max_retries=5,
    silo_mode=SiloMode.REGION,
)
def delete_recording_segments(project_id: int, replay_id: str, **kwargs: Any) -> None:
    """Asynchronously delete a replay."""
    metrics.incr("replays.delete_recording_segments", amount=1, tags={"status": "started"})
    archive_replay(project_id, replay_id)
    delete_replay_recording(project_id, replay_id)
    metrics.incr("replays.delete_recording_segments", amount=1, tags={"status": "finished"})


def delete_replay_recording(project_id: int, replay_id: str) -> None:
    """Delete all recording-segments associated with a Replay."""
    segments_from_metadata = fetch_segments_metadata(project_id, replay_id, offset=0, limit=10000)
    metrics.distribution("replays.num_segments_deleted", value=len(segments_from_metadata))

    # Fetch any recording-segment models that may have been written.
    segments_from_django_models = ReplayRecordingSegment.objects.filter(
        replay_id=replay_id, project_id=project_id
    ).all()

    # Filestore and direct storage segments are split into two different delete operations.
    direct_storage_segments = []
    filestore_segments = []
    for segment in segments_from_metadata:
        if segment.file_id:
            filestore_segments.append(segment)
        else:
            direct_storage_segments.append(segment)

    # Issue concurrent delete requests when interacting with a remote service provider.
    with cf.ThreadPoolExecutor(max_workers=100) as pool:
        pool.map(storage.delete, direct_storage_segments)

    # This will only run if "filestore" was used to store the files. This hasn't been the
    # case since March of 2023. This exists to serve self-hosted customers with the filestore
    # configuration still enabled. This should be fast enough for those use-cases.
    for segment in filestore_segments:
        filestore.delete(segment)
    for segment in segments_from_django_models:
        segment.delete()


def archive_replay(project_id: int, replay_id: str) -> None:
    """Archive a Replay instance. The Replay is not deleted."""
    replay_payload: dict[str, Any] = {
        "type": "replay_event",
        "replay_id": replay_id,
        "event_id": uuid.uuid4().hex,
        "segment_id": None,
        "trace_ids": [],
        "error_ids": [],
        "urls": [],
        "timestamp": time.time(),
        "is_archived": True,
        "platform": "",
    }

    publisher = initialize_replays_publisher()
    publisher.publish(
        "ingest-replay-events",
        json.dumps(
            {
                "type": "replay_event",
                "start_time": int(time.time()),
                "replay_id": replay_id,
                "project_id": project_id,
                "segment_id": None,
                "retention_days": 30,
                "payload": list(bytes(json.dumps(replay_payload).encode())),
            }
        ),
    )
