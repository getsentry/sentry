from __future__ import annotations

import concurrent.futures as cf
from typing import Any

from google.cloud.exceptions import NotFound

from sentry.replays.lib.kafka import initialize_replays_publisher
from sentry.replays.lib.storage import filestore, make_video_filename, storage, storage_kv
from sentry.replays.models import ReplayRecordingSegment
from sentry.replays.usecases.events import archive_event
from sentry.replays.usecases.reader import fetch_segments_metadata
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics
from sentry.utils.pubsub import KafkaPublisher


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
    publisher = initialize_replays_publisher(is_async=False)
    archive_replay(publisher, project_id, replay_id)
    delete_replay_recording(project_id, replay_id)
    metrics.incr("replays.delete_recording_segments", amount=1, tags={"status": "finished"})


@instrumented_task(
    name="sentry.replays.tasks.delete_replay_recording_async",
    queue="replays.delete_replay",
    default_retry_delay=5,
    max_retries=5,
    silo_mode=SiloMode.REGION,
)
def delete_replay_recording_async(project_id: int, replay_id: str) -> None:
    delete_replay_recording(project_id, replay_id)


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
    video_filenames = []
    for segment in segments_from_metadata:
        video_filenames.append(make_video_filename(segment))
        if segment.file_id:
            filestore_segments.append(segment)
        else:
            direct_storage_segments.append(segment)

    # Issue concurrent delete requests when interacting with a remote service provider.
    with cf.ThreadPoolExecutor(max_workers=100) as pool:
        pool.map(_delete_if_exists, video_filenames)
        if direct_storage_segments:
            pool.map(storage.delete, direct_storage_segments)

    # This will only run if "filestore" was used to store the files. This hasn't been the
    # case since March of 2023. This exists to serve self-hosted customers with the filestore
    # configuration still enabled. This should be fast enough for those use-cases.
    for segment in filestore_segments:
        filestore.delete(segment)
    for segment_model in segments_from_django_models:
        segment_model.delete()


def archive_replay(publisher: KafkaPublisher, project_id: int, replay_id: str) -> None:
    """Archive a Replay instance. The Replay is not deleted."""
    message = archive_event(project_id, replay_id)

    # We publish manually here because we sometimes provide a managed Kafka
    # publisher interface which has its own setup and teardown behavior.
    publisher.publish("ingest-replay-events", message)


def _delete_if_exists(filename: str) -> None:
    """Delete the blob if it exists or silence the 404."""
    try:
        storage_kv.delete(filename)
    except NotFound:
        pass
