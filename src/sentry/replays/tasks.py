import time
import uuid

from sentry.replays.lib.storage import FilestoreBlob, StorageBlob
from sentry.replays.models import ReplayRecordingSegment
from sentry.replays.publishers import initialize_replay_event_publisher
from sentry.replays.usecases.reader import fetch_segments_metadata
from sentry.tasks.base import instrumented_task
from sentry.utils import json


@instrumented_task(
    name="sentry.replays.tasks.delete_recording_segments",
    queue="replays.delete_replay",
    default_retry_delay=5,
    max_retries=5,
)
def delete_recording_segments(project_id: int, replay_id: str, **kwargs: dict) -> None:
    """Asynchronously delete a replay."""
    delete_replay_recording(project_id, replay_id)
    archive_replay(project_id, replay_id)


def delete_replay_recording(project_id: int, replay_id: str) -> None:
    """Delete all recording-segments associated with a Replay."""
    segments = fetch_segments_metadata(project_id, replay_id, offset=0, limit=10000)
    for segment in segments:
        driver = FilestoreBlob() if segment.file_id else StorageBlob()
        driver.delete(segment)

    # delete old rows from SQL too
    segment_sql_rows = ReplayRecordingSegment.objects.filter(
        replay_id=replay_id, project_id=project_id
    ).all()
    for segment in segment_sql_rows:
        segment.delete()  # Three queries + one request to the message broker


def archive_replay(project_id: int, replay_id: str) -> None:
    """Archive a Replay instance. The Replay is not deleted."""
    replay_payload = {
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

    publisher = initialize_replay_event_publisher()
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
