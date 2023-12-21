from __future__ import annotations

import time
import uuid
from typing import Any

from sentry.replays.lib.kafka import initialize_replays_publisher
from sentry.replays.lib.storage import filestore, storage
from sentry.replays.models import ReplayRecordingSegment
from sentry.replays.usecases.reader import fetch_segments_metadata
from sentry.utils import json


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


def delete_replay_recording(project_id: int, replay_id: str) -> None:
    """Delete all recording-segments associated with a Replay."""
    # Delete the segments which are now stored in clickhouse
    segments_from_metadata = fetch_segments_metadata(project_id, replay_id, offset=0, limit=10000)
    for segment_metadata in segments_from_metadata:
        driver = filestore if segment_metadata.file_id else storage
        driver.delete(segment_metadata)

    # Delete the ReplayRecordingSegment models that we previously stored using django models
    segments_from_django_models = ReplayRecordingSegment.objects.filter(
        replay_id=replay_id, project_id=project_id
    ).all()
    for segment_model in segments_from_django_models:
        segment_model.delete()  # Three queries + one request to the message broker
