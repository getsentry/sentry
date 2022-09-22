import time
import uuid

from django.conf import settings

from sentry.replays.models import ReplayRecordingSegment
from sentry.tasks.base import instrumented_task
from sentry.utils import json, kafka_config
from sentry.utils.pubsub import KafkaPublisher


@instrumented_task(
    name="sentry.replays.tasks.delete_recording_segments",
    queue="default",
    default_retry_delay=5,
    max_retries=5,
)
def delete_recording_segments(project_id: int, replay_id: str, **kwargs: dict) -> None:
    """Asynchronously delete a replay."""
    _delete_replay_recording(project_id, replay_id)
    _archive_replay(replay_id)


def _delete_replay_recording(project_id: int, replay_id: str) -> None:
    """Delete all recording-segments associated with a Replay."""
    segments = ReplayRecordingSegment.objects.filter(
        replay_id=replay_id, project_id=project_id
    ).all()
    for segment in segments:
        segment.delete()  # Three queries + one request to the message broker


def _archive_replay(replay_id: str) -> None:
    """Archive a Replay instance. The Replay is not deleted."""
    config = settings.KAFKA_TOPICS[settings.KAFKA_INGEST_REPLAY_EVENTS]
    replay_publisher = KafkaPublisher(
        kafka_config.get_kafka_producer_cluster_options(config["cluster"]),
    )

    replay_publisher.publish(
        "ingest-replay-events",
        json.dumps(
            {
                "type": "replay_event",
                "replay_id": replay_id,
                "event_id": uuid.uuid4().hex,
                "segment_id": None,
                "timestamp": time.time(),
                "is_deleted": True,
            }
        ),
    )
