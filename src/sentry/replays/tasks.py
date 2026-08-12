from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import sentry_sdk
from django.utils import timezone
from taskbroker_client.retry import Retry
from taskbroker_client.state import current_task
from taskbroker_client.worker.workerchild import ProcessingDeadlineExceeded

from sentry.replays.consumers.recording import commit_message, process_message
from sentry.replays.lib.kafka import PROCESS_REPLAY_RECORDING_TASK_NAME, publish_replay_event
from sentry.replays.lib.storage import (
    RecordingSegmentStorageMeta,
    filestore,
    make_recording_filename,
    storage,
)
from sentry.replays.models import DeletionJobStatus, ReplayDeletionJobModel, ReplayRecordingSegment
from sentry.replays.usecases.delete import (
    DELETE_THREAD_POOL_SIZE,
    day_aligned_windows,
    delete_filenames_concurrently,
    delete_matched_rows,
    delete_seer_replay_data,
    fetch_rows_matching_pattern,
)
from sentry.replays.usecases.events import archive_event
from sentry.replays.usecases.ingest.types import ProcessorContext
from sentry.replays.usecases.reader import fetch_segments_metadata
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import replays_long_tasks, replays_raw_tasks, replays_tasks
from sentry.utils import metrics
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor

logger = logging.getLogger()


@instrumented_task(
    name="sentry.replays.tasks.delete_replay",
    namespace=replays_tasks,
    processing_deadline_duration=120,
    retry=Retry(times=5),
    silo_mode=SiloMode.CELL,
)
def delete_replay(
    project_id: int,
    replay_id: str,
    has_seer_data: bool = False,
    organization_id: int | None = None,
    **kwargs: Any,
) -> None:
    """Asynchronously delete a replay."""
    metrics.incr("replays.delete_replay", amount=1, tags={"status": "started"})
    # It would be _much better_ to actually fetch the Replay's timestamp here,
    # and issue `archive_replay` with a timestamp. Something to fix in the near
    # future. Otherwise, if the delete event is too far away from the Replay it
    # might show up as un-archived in the UI depending on the query range.
    archive_replay(project_id, replay_id, timezone.now())
    delete_replay_recording(project_id, replay_id)

    if has_seer_data and organization_id is not None:
        # Note organization_id=None is a default, for backwards task compatibility.
        delete_seer_replay_data(organization_id, project_id, [replay_id])

    metrics.incr("replays.delete_replay", amount=1, tags={"status": "finished"})


@instrumented_task(
    name=PROCESS_REPLAY_RECORDING_TASK_NAME,
    namespace=replays_raw_tasks,
    retry=Retry(times=3, delay=5),
    silo_mode=SiloMode.CELL,
)
def process_replay_recording(message_bytes: bytes) -> None:
    """Process a replay recording from raw Kafka message bytes.

    This task is directly spawned from taskbroker in "raw mode". You won't find
    any application code that calls apply_async or delay directly on it, instead
    taskbroker itself is configured to consume the ingest-replay-recordings
    topic (in infra templates) and spawns a task for each message.

    As such, the task signature, name and namespace cannot be changed without
    coordination.
    """
    processed_message = process_message(message_bytes)
    if processed_message:
        # The per-partition query caches that the consumer builds in
        # create_with_partitions don't apply when each message is processed as an
        # independent task, so we always use the uncached path here.
        context: ProcessorContext = {
            "has_sent_replays_cache": None,
            "options_cache": None,
        }
        commit_message(processed_message, context)


@instrumented_task(
    name="sentry.replays.tasks.delete_recording_async",
    namespace=replays_long_tasks,
    alias_namespace=replays_tasks,
    processing_deadline_duration=120,
    retry=Retry(times=5, delay=5),
    silo_mode=SiloMode.CELL,
)
def delete_replays_script_async(
    retention_days: int,
    project_id: int,
    replay_id: str,
    max_segment_id: int | None,
) -> None:
    if max_segment_id is None:
        return None

    segments = [
        RecordingSegmentStorageMeta(
            project_id=project_id,
            replay_id=replay_id,
            segment_id=i,
            retention_days=retention_days,
        )
        for i in range(max_segment_id + 1)
    ]

    rrweb_filenames = []
    for segment in segments:
        rrweb_filenames.append(make_recording_filename(segment))

    delete_filenames_concurrently(rrweb_filenames)

    # Backwards compatibility. Should be deleted one day.
    segments_from_django_models = ReplayRecordingSegment.objects.filter(
        replay_id=replay_id, project_id=project_id
    ).all()
    for segment_model in segments_from_django_models:
        segment_model.delete()


@instrumented_task(
    name="sentry.replays.tasks.delete_replay_recording_async",
    namespace=replays_tasks,
    processing_deadline_duration=120,
    retry=Retry(times=5, delay=5),
    silo_mode=SiloMode.CELL,
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
    for segment in segments_from_metadata:
        if segment.file_id:
            filestore_segments.append(segment)
        else:
            direct_storage_segments.append(segment)

    # Issue concurrent delete requests when interacting with a remote service provider.
    # Make the threads reuse one client instead of racing to build their own
    if direct_storage_segments:
        storage.initialize_client()
        max_workers = min(len(direct_storage_segments), DELETE_THREAD_POOL_SIZE)
        with ContextPropagatingThreadPoolExecutor(max_workers=max_workers) as pool:
            pool.map(storage.delete, direct_storage_segments)

    # This will only run if "filestore" was used to store the files. This hasn't been the
    # case since March of 2023. This exists to serve self-hosted customers with the filestore
    # configuration still enabled. This should be fast enough for those use-cases.
    for segment in filestore_segments:
        filestore.delete(segment)
    for segment_model in segments_from_django_models:
        segment_model.delete()


def archive_replay(project_id: int, replay_id: str, timestamp: datetime) -> None:
    """Archive a Replay instance. The Replay is not deleted."""
    message = archive_event(project_id, replay_id, timestamp)

    # We publish manually here because we sometimes provide a managed Kafka
    # publisher interface which has its own setup and teardown behavior.
    publish_replay_event(message)


@instrumented_task(
    name="sentry.replays.tasks.run_bulk_replay_delete_job",
    namespace=replays_long_tasks,
    # Keep the task registered under the old `replays` namespace as well so
    # any activations that were enqueued before this deploy (with
    # namespace="replays") continue to resolve and execute.
    alias_namespace=replays_tasks,
    retry=Retry(times=5, on=(ProcessingDeadlineExceeded,)),
    processing_deadline_duration=600,
    silo_mode=SiloMode.CELL,
)
def run_bulk_replay_delete_job(
    replay_delete_job_id: int,
    offset: int | None = None,
    limit: int = 100,
    has_seer_data: bool = False,
    total_deleted: int = 0,
    window_offset_days: int = 0,
    after_replay_id_hash: int | None = None,
) -> None:
    """Replay bulk deletion task.

    Pages through the job's range with a keyset cursor on `cityHash64(replay_id)` and chains a
    follow-up activation per page. Each page is idempotent: re-running one re-deletes blobs that
    are already gone (a swallowed 404) and re-publishes an archive event.

    `offset` is the cursor from the previous deploy's `OFFSET` pagination. It is accepted and
    ignored so activations enqueued before this deploy still resolve; such an activation restarts
    its window from the beginning rather than failing. Remove the argument once the queue has
    drained.
    """
    job = ReplayDeletionJobModel.objects.get(id=replay_delete_job_id)

    # If this is the first run of the task we set the model to in-progress.
    if job.status == DeletionJobStatus.PENDING:
        metrics.incr("replays.bulk_delete_job", tags={"status": "started"}, sample_rate=1.0)
        _transition_status(job.id, DeletionJobStatus.PENDING, DeletionJobStatus.IN_PROGRESS)
        job.status = DeletionJobStatus.IN_PROGRESS

    # Exit if the job status is failed or completed.
    if job.status != DeletionJobStatus.IN_PROGRESS:
        return None

    # Windows are recomputed from the job's range on every activation rather than stored, so
    # job.range_start is never mutated and the API always returns the original range. One window per
    # day means `window_offset_days` indexes them directly.
    windows = day_aligned_windows(job.range_start, job.range_end)
    if window_offset_days >= len(windows):
        # The chain never schedules an offset past the last window, so this only catches an
        # activation enqueued before the range was windowed the way it is now. Complete rather than
        # let the index raise, which would fail the task and strand the job in progress.
        _complete_job(job.id)
        return None

    window_start, window_end = windows[window_offset_days]

    sentry_sdk.set_context(
        "ReplayDeletionJobModel",
        {
            "id": job.id,
            "organization_id": job.organization_id,
            "project_id": job.project_id,
            "range_start": job.range_start.isoformat(),
            "range_end": job.range_end.isoformat(),
            "status": job.status,
        },
    )
    sentry_sdk.set_context(
        "replay_delete_window",
        {
            "window_start": window_start.isoformat(),
            "window_end": window_end.isoformat(),
            "window_offset_days": window_offset_days,
            "after_replay_id_hash": after_replay_id_hash,
            "limit": limit,
        },
    )

    try:
        # Delete the replays within a limited range. If more replays exist a cursor to seek the next
        # page from is returned.
        results = fetch_rows_matching_pattern(
            project_id=job.project_id,
            start=window_start,
            end=window_end,
            query=job.query,
            environment=job.environments,
            limit=limit,
            after_replay_id_hash=after_replay_id_hash,
        )

        # Delete the matched rows if any rows were returned.
        if len(results["rows"]) > 0:
            replay_ids = [row["replay_id"] for row in results["rows"]]

            delete_matched_rows(job.project_id, results["rows"])
            # Track job progress with a state transition metric
            metrics.incr("replays.bulk_delete_job", tags={"status": "in_progress"}, sample_rate=1.0)
            # Track the count of deleted rows separately
            metrics.incr(
                "replays.bulk_delete_job.rows_deleted",
                amount=len(replay_ids),
                sample_rate=1.0,
            )
            if has_seer_data:
                delete_seer_replay_data(job.organization_id, job.project_id, replay_ids)

    except ProcessingDeadlineExceeded:
        # Catch `ProcessingDeadlineExceeded` so we can mark the job correctly in the database,
        # then re-raise so the re-try fires.
        task = current_task()
        if task is None or not task.retries_remaining:
            logger.warning("Bulk delete replays exhausted its processing deadline retries.")
            metrics.incr("replays.bulk_delete_job", tags={"status": "failed"}, sample_rate=1.0)
            _transition_status(job.id, DeletionJobStatus.IN_PROGRESS, DeletionJobStatus.FAILED)
        raise
    except Exception:
        logger.exception("Bulk delete replays failed.")

        metrics.incr("replays.bulk_delete_job", tags={"status": "failed"}, sample_rate=1.0)
        _transition_status(job.id, DeletionJobStatus.IN_PROGRESS, DeletionJobStatus.FAILED)
        raise

    # `new_total` is the running count of all replays deleted across all windows.
    num_rows_deleted = len(results["rows"])
    new_total = total_deleted + num_rows_deleted

    # A null cursor with `has_more` set only happens for `limit=0`, where every page is empty and
    # seeks nowhere. Treating that as "window done" stops it chaining activations forever.
    next_cursor = results["next_cursor"]

    # This page's deletes are done, so checkpoint before deciding what comes next.
    _advance_offset(job.id, new_total)

    if results["has_more"] and next_cursor is not None:
        # More pages in this window.
        run_bulk_replay_delete_job.delay(
            job.id,
            limit=limit,
            has_seer_data=has_seer_data,
            total_deleted=new_total,
            window_offset_days=window_offset_days,
            after_replay_id_hash=next_cursor,
        )
        return None

    # Window exhausted and there is no next one to schedule, so the job is done.
    if window_offset_days + 1 >= len(windows):
        _complete_job(job.id)
        return None

    run_bulk_replay_delete_job.delay(
        job.id,
        limit=limit,
        has_seer_data=has_seer_data,
        total_deleted=new_total,
        window_offset_days=window_offset_days + 1,
        # Reset the cursor: it is a position within a window's result set, not a global one.
        after_replay_id_hash=None,
    )
    return None


def _complete_job(job_id: int) -> None:
    _transition_status(job_id, DeletionJobStatus.IN_PROGRESS, DeletionJobStatus.COMPLETED)
    metrics.incr("replays.bulk_delete_job", tags={"status": "completed"}, sample_rate=1.0)


def _advance_offset(job_id: int, offset: int) -> None:
    """Checkpoint progress, filtered so a lagging duplicate chain cannot rewind the counter."""
    ReplayDeletionJobModel.objects.filter(id=job_id, offset__lt=offset).update(
        offset=offset, date_updated=timezone.now()
    )


def _transition_status(job_id: int, expected: DeletionJobStatus, new: DeletionJobStatus) -> None:
    """Transition status only from `expected`, and without `save()` rewriting the whole row."""
    ReplayDeletionJobModel.objects.filter(id=job_id, status=expected).update(
        status=new, date_updated=timezone.now()
    )
