from __future__ import annotations

import concurrent.futures as cf
from typing import Any

from google.cloud.exceptions import NotFound

from sentry.replays.lib.kafka import initialize_replays_publisher
from sentry.replays.lib.storage import (
    RecordingSegmentStorageMeta,
    filestore,
    make_recording_filename,
    storage,
    storage_kv,
)
from sentry.replays.models import DeletionJobStatus, ReplayDeletionJobModel, ReplayRecordingSegment
from sentry.replays.usecases.delete import delete_matched_rows, fetch_rows_matching_pattern
from sentry.replays.usecases.events import archive_event
from sentry.replays.usecases.reader import fetch_segments_metadata
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import replays_tasks
from sentry.taskworker.retry import Retry
from sentry.utils import metrics
from sentry.utils.pubsub import KafkaPublisher


@instrumented_task(
    name="sentry.replays.tasks.delete_recording_segments",
    queue="replays.delete_replay",
    default_retry_delay=5,
    max_retries=5,
    silo_mode=SiloMode.REGION,
    taskworker_config=TaskworkerConfig(
        namespace=replays_tasks,
        processing_deadline_duration=120,
        retry=Retry(
            times=5,
        ),
    ),
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
    taskworker_config=TaskworkerConfig(
        namespace=replays_tasks,
        processing_deadline_duration=120,
        retry=Retry(
            times=5,
            delay=5,
        ),
    ),
)
def delete_replay_recording_async(project_id: int, replay_id: str) -> None:
    delete_replay_recording(project_id, replay_id)


@instrumented_task(
    name="sentry.replays.tasks.delete_recording_async",
    queue="replays.delete_replay",
    default_retry_delay=5,
    max_retries=5,
    silo_mode=SiloMode.REGION,
    taskworker_config=TaskworkerConfig(
        namespace=replays_tasks,
        processing_deadline_duration=120,
        retry=Retry(
            times=5,
            delay=5,
        ),
    ),
)
def delete_replays_script_async(
    retention_days: int,
    project_id: int,
    replay_id: str,
    max_segment_id: int,
) -> None:
    segments = [
        RecordingSegmentStorageMeta(
            project_id=project_id,
            replay_id=replay_id,
            segment_id=i,
            retention_days=retention_days,
        )
        for i in range(0, max_segment_id)
    ]

    rrweb_filenames = []
    for segment in segments:
        rrweb_filenames.append(make_recording_filename(segment))

    with cf.ThreadPoolExecutor(max_workers=100) as pool:
        pool.map(_delete_if_exists, rrweb_filenames)

    # Backwards compatibility. Should be deleted one day.
    segments_from_django_models = ReplayRecordingSegment.objects.filter(
        replay_id=replay_id, project_id=project_id
    ).all()
    for segment_model in segments_from_django_models:
        segment_model.delete()


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


@instrumented_task(
    name="sentry.replays.tasks.run_bulk_replay_delete_job",
    queue="replays.delete_replay",
    default_retry_delay=5,
    max_retries=5,
    acks_late=True,
    silo_mode=SiloMode.REGION,
    taskworker_config=TaskworkerConfig(
        namespace=replays_tasks, retry=Retry(times=5), processing_deadline_duration=300
    ),
)
def run_bulk_replay_delete_job(replay_delete_job_id: int, offset: int, limit: int = 100) -> None:
    """Replay bulk deletion task.

    We specify retry behavior in the task definition. However, if the task fails more than 5 times
    the process will stop and the task has permanently failed. We checkpoint our offset position
    in the model. Restarting the task will use the offset passed by the caller. If you want to
    restart the task from the previous checkpoint you must pass the checkpoint explicitly.
    """
    job = ReplayDeletionJobModel.objects.get(id=replay_delete_job_id)

    # This should be impossible but if we re-schedule the task and the job is not in-progress or
    # pending then something went wrong.
    if job.status not in (DeletionJobStatus.PENDING, DeletionJobStatus.IN_PROGRESS):
        return None

    # If this is the first run of the task we set the model to in-progress.
    if offset == 0:
        job.status = DeletionJobStatus.IN_PROGRESS
        job.save()

    try:
        # Delete the replays within a limited range. If more replays exist an incremented offset value
        # is returned.
        results = fetch_rows_matching_pattern(
            project_id=job.project_id,
            start=job.range_start,
            end=job.range_end,
            query=job.query,
            environment=job.environments,
            limit=limit,
            offset=offset,
        )

        # Delete the matched rows if any rows were returned.
        if len(results["rows"]) > 0:
            delete_matched_rows(job.project_id, results["rows"])
    except Exception:
        job.status = DeletionJobStatus.FAILED
        job.save()
        raise

    # Compute the next offset to start from. If no further processing is required then this serves
    # as a count of replays deleted.
    next_offset = offset + len(results["rows"])

    if results["has_more"]:
        # Checkpoint before continuing.
        job.offset = next_offset
        job.save()

        run_bulk_replay_delete_job.delay(job.id, next_offset)
        return None
    else:
        # If we've finished deleting all the replays for the selection. We can move the status to
        # completed and exit the call chain.
        job.offset = next_offset
        job.status = DeletionJobStatus.COMPLETED
        job.save()
        return None


@instrumented_task(
    name="sentry.replays.tasks.delete_replay",
    queue="replays.delete_replay",
    default_retry_delay=5,
    max_retries=5,
    acks_late=True,
    silo_mode=SiloMode.REGION,
    taskworker_config=TaskworkerConfig(
        namespace=replays_tasks, retry=Retry(times=5), processing_deadline_duration=120
    ),
)
def delete_replay(
    retention_days: int,
    project_id: int,
    replay_id: str,
    max_segment_id: int,
) -> None:
    """Single replay deletion task."""
    delete_matched_rows(
        project_id=project_id,
        rows=[
            {
                "max_segment_id": max_segment_id,
                "replay_id": replay_id,
                "retention_days": retention_days,
            }
        ],
    )
