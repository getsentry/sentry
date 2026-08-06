from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

import sentry_sdk
from django.utils import timezone
from taskbroker_client.constants import CompressionType
from taskbroker_client.retry import Retry
from taskbroker_client.state import current_task
from taskbroker_client.worker.workerchild import ProcessingDeadlineExceeded

from sentry import options
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
    archive_replay(project_id, replay_id)
    delete_replay_recording(project_id, replay_id)

    if has_seer_data and organization_id is not None:
        # Note organization_id=None is a default, for backwards task compatibility.
        delete_seer_replay_data(organization_id, project_id, [replay_id])

    metrics.incr("replays.delete_replay", amount=1, tags={"status": "finished"})


@instrumented_task(
    name=PROCESS_REPLAY_RECORDING_TASK_NAME,
    namespace=replays_raw_tasks,
    processing_deadline_duration=90,
    retry=Retry(times=3, delay=5),
    compression_type=CompressionType.ZSTD,
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


def archive_replay(project_id: int, replay_id: str) -> None:
    """Archive a Replay instance. The Replay is not deleted."""
    message = archive_event(project_id, replay_id)

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
    chunk_size_days = options.get("replay.bulk_delete_job.chunk_size_days") or 7
    job = ReplayDeletionJobModel.objects.get(id=replay_delete_job_id)

    # If this is the first run of the task we set the model to in-progress.
    if job.status == DeletionJobStatus.PENDING:
        metrics.incr("replays.bulk_delete_job", tags={"status": "started"}, sample_rate=1.0)
        _transition_status(job.id, DeletionJobStatus.PENDING, DeletionJobStatus.IN_PROGRESS)
        job.status = DeletionJobStatus.IN_PROGRESS

    # Exit if the job status is failed or completed.
    if job.status != DeletionJobStatus.IN_PROGRESS:
        return None

    # Derive the current window boundaries from the immutable job range and the cursor.
    # Chunking into 7-day windows avoids full table scans in ClickHouse.
    window_start = job.range_start + timedelta(days=window_offset_days)
    window_end = min(window_start + timedelta(days=chunk_size_days), job.range_end)

    # Name the job and the window on everything this activation reports, so an error from any layer
    # is attributable. Without it a Snuba, blob-store or Seer failure is a stack trace with no way
    # back to a job or a date range: both live only in the activation's arguments.
    _set_error_context(
        job,
        window_start=window_start,
        window_end=window_end,
        window_offset_days=window_offset_days,
        after_replay_id_hash=after_replay_id_hash,
        limit=limit,
        total_deleted=total_deleted,
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

        # One per Snuba query, so pages can be compared against activations created, and empty pages
        # -- work spent finding nothing -- are visible rather than inferred.
        metrics.incr(
            "replays.bulk_delete_job.page",
            tags={"outcome": "rows" if results["rows"] else "empty"},
            sample_rate=1.0,
        )

        # Delete the matched rows if any rows were returned.
        if len(results["rows"]) > 0:
            delete_matched_rows(job.project_id, results["rows"])
            # Track job progress with a state transition metric
            metrics.incr("replays.bulk_delete_job", tags={"status": "in_progress"}, sample_rate=1.0)
            # Track the count of deleted rows separately
            metrics.incr(
                "replays.bulk_delete_job.rows_deleted",
                amount=len(results["rows"]),
                sample_rate=1.0,
            )
            if has_seer_data:
                seer_deleted = delete_seer_replay_data(
                    job.organization_id,
                    job.project_id,
                    [row["replay_id"] for row in results["rows"]],
                )
                # `delete_seer_replay_data` swallows its own failures and returns False, and the
                # return value was dropped -- so a Seer outage was invisible and the job still
                # reported success. Staying non-fatal is right, because the replays and their blobs
                # are already gone and raising would re-run the whole window, but a failure leaves AI
                # summaries behind. That is undeleted PII, so it has to be countable.
                metrics.incr(
                    "replays.bulk_delete_job.seer_delete",
                    tags={"outcome": "success" if seer_deleted else "failure"},
                    sample_rate=1.0,
                )
    except ProcessingDeadlineExceeded:
        # A BaseException, so it escapes the handler below. Once retries run out the broker
        # discards the activation, which leaves the job reporting "in-progress" forever with
        # nothing left to advance it.
        task = current_task()
        if task is not None and not task.retries_remaining:
            logger.warning(
                "Bulk delete replays exhausted its processing deadline retries.",
                extra=_logging_context(job, window_start, window_end),
            )
            metrics.incr("replays.bulk_delete_job", tags={"status": "failed"}, sample_rate=1.0)
            _transition_status(job.id, DeletionJobStatus.IN_PROGRESS, DeletionJobStatus.FAILED)
        raise
    except Exception:
        logger.exception(
            "Bulk delete replays failed.", extra=_logging_context(job, window_start, window_end)
        )

        metrics.incr("replays.bulk_delete_job", tags={"status": "failed"}, sample_rate=1.0)
        _transition_status(job.id, DeletionJobStatus.IN_PROGRESS, DeletionJobStatus.FAILED)
        raise

    # `new_total` is the running count of all replays deleted across all windows.
    num_rows_deleted = len(results["rows"])
    new_total = total_deleted + num_rows_deleted

    # A null cursor with `has_more` set only happens for `limit=0`, where every page is empty and
    # seeks nowhere. Treating that as "window done" stops it chaining activations forever.
    next_cursor = results["next_cursor"]

    if results["has_more"] and next_cursor is not None:
        # Checkpoint before continuing within the same window.
        _checkpoint(job.id, new_total)
        run_bulk_replay_delete_job.delay(
            job.id,
            limit=limit,
            has_seer_data=has_seer_data,
            total_deleted=new_total,
            window_offset_days=window_offset_days,
            after_replay_id_hash=next_cursor,
        )
        return None

    # Current window exhausted. Counted here rather than in the branches below so the total equals
    # windows finished, which is the only progress signal for a job that is deleting nothing.
    metrics.incr("replays.bulk_delete_job.window_completed", sample_rate=1.0)

    # Check if more time windows remain.
    if window_end < job.range_end:
        # Advance to the next window by incrementing the day offset in the task args, and reset the
        # cursor: it is a position within a window's result set, not a global one.
        # job.range_start is never mutated so the API always returns the original range.
        _checkpoint(job.id, new_total)
        run_bulk_replay_delete_job.delay(
            job.id,
            limit=limit,
            has_seer_data=has_seer_data,
            total_deleted=new_total,
            window_offset_days=window_offset_days + chunk_size_days,
            after_replay_id_hash=None,
        )
        return None

    # All windows processed. Mark the job as completed.
    _checkpoint(job.id, new_total)
    _transition_status(job.id, DeletionJobStatus.IN_PROGRESS, DeletionJobStatus.COMPLETED)
    metrics.incr("replays.bulk_delete_job", tags={"status": "completed"}, sample_rate=1.0)
    return None


def _checkpoint(job_id: int, deleted: int) -> None:
    """Record progress, and liveness separately from it.

    Two statements because they answer different questions and need different guards. `offset` is
    filtered so a lagging duplicate chain cannot rewind the count. `date_updated` is not filtered,
    because it is the only signal separating a job still walking replay-free days from one whose
    activation chain has died -- and a window that deletes nothing is still progress. Updating both
    under the `offset__lt` guard made those two states indistinguishable, so a stalled job could not
    be told apart from a quiet one.
    """
    ReplayDeletionJobModel.objects.filter(id=job_id, offset__lt=deleted).update(offset=deleted)
    ReplayDeletionJobModel.objects.filter(id=job_id).update(date_updated=timezone.now())


def _set_error_context(
    job: ReplayDeletionJobModel,
    window_start: datetime,
    window_end: datetime,
    window_offset_days: int,
    after_replay_id_hash: int | None,
    limit: int,
    total_deleted: int,
) -> None:
    """Attach the job's identity and position to whatever this activation reports.

    Tags are the few low-cardinality keys worth searching and grouping by in Sentry. The context
    carries the rest, including the job's whole range, so a single event answers "which range do I
    have to run again" without cross-referencing the database.
    """
    sentry_sdk.set_tags(
        {
            "replay_delete.job": job.id,
            "replay_delete.project": job.project_id,
            "replay_delete.window": window_start.date().isoformat(),
        }
    )
    sentry_sdk.set_context("replay_delete_job", _logging_context(job, window_start, window_end))
    sentry_sdk.set_context(
        "replay_delete_position",
        {
            "window_offset_days": window_offset_days,
            "after_replay_id_hash": after_replay_id_hash,
            "limit": limit,
            "deleted_before_this_page": total_deleted,
        },
    )


def _logging_context(
    job: ReplayDeletionJobModel, window_start: datetime, window_end: datetime
) -> dict[str, Any]:
    return {
        "job_id": job.id,
        "organization_id": job.organization_id,
        "project_id": job.project_id,
        "range_start": job.range_start.isoformat(),
        "range_end": job.range_end.isoformat(),
        "window_start": window_start.isoformat(),
        "window_end": window_end.isoformat(),
    }


def _transition_status(job_id: int, expected: DeletionJobStatus, new: DeletionJobStatus) -> None:
    """Transition status only from `expected`, and without `save()` rewriting the whole row."""
    ReplayDeletionJobModel.objects.filter(id=job_id, status=expected).update(
        status=new, date_updated=timezone.now()
    )
