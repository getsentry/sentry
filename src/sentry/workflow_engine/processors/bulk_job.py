"""
Generic bulk job processing infrastructure.

Provides a registry-based framework for defining and executing bulk background jobs
with job-specific work chunk processing, coordination, and status tracking.

## Quick Start: Adding a New Bulk Job

### 1. Define Your Work Chunk Model

Create a Pydantic model representing a unit of work:

```python
from pydantic import BaseModel

class MyJobWorkChunk(BaseModel):
    resource_id: int
    # Add any other fields needed to process this chunk
```

### 2. Create Your Job Spec

Subclass BulkJobSpec and implement the required methods:

```python
from sentry.workflow_engine.processors.bulk_job import BulkJobSpec, bulk_job_registry

class MyBulkJob(BulkJobSpec):
    job_type = "my_job_type"
    work_chunk_model = MyJobWorkChunk

    # Optional: Override coordination settings (defaults shown)
    max_batch_size = 100           # Max tasks to schedule per coordinator run
    target_running_tasks = 50      # Target concurrent tasks
    in_progress_timeout = timedelta(hours=1)       # Timeout for stuck tasks
    completed_cleanup_age = timedelta(days=30)     # Age before cleanup

    def process_work_chunk(self, work_chunk: BaseModel) -> dict[str, Any]:
        # Implement your processing logic
        assert isinstance(work_chunk, MyJobWorkChunk)
        # ... do work ...
        return {"processed": True}  # Return metadata for logging

    def generate_work_chunks(self, start_from: str | None) -> Iterable[BaseModel]:
        # Generate all work chunks, optionally resuming from a key
        queryset = MyModel.objects.all()
        if start_from:
            resource_id = int(start_from.split(":")[-1])
            queryset = queryset.filter(id__gte=resource_id)

        for item in queryset:
            yield MyJobWorkChunk(resource_id=item.id)

    def get_batch_key(self, work_chunk: BaseModel) -> str:
        # Return a unique key for deduplication
        assert isinstance(work_chunk, MyJobWorkChunk)
        return f"my_job:{work_chunk.resource_id}"

# Register your job
MY_BULK_JOB = MyBulkJob()
bulk_job_registry.register(MY_BULK_JOB.job_type)(MY_BULK_JOB)
```

### 3. Use the Generic Tasks

The generic tasks in `sentry.workflow_engine.tasks.bulk_job` work with any registered job:

```python
from sentry.workflow_engine.tasks.bulk_job import (
    populate_bulk_job_records_task,
    coordinate_bulk_jobs_task,
    process_bulk_job_task,
)

# Populate: Create BulkJobStatus records for all work chunks
populate_bulk_job_records_task.apply_async(kwargs={"job_type": "my_job_type"})

# Coordinate: Schedule tasks to process pending jobs (run periodically)
coordinate_bulk_jobs_task.apply_async(kwargs={"job_type": "my_job_type"})

# Process: Execute a single job (scheduled by coordinator)
process_bulk_job_task.apply_async(
    kwargs={"job_status_id": 123, "job_type": "my_job_type"}
)
```

### 4. Monitor Progress

Track job progress using BulkJobStatus records:

```python
from sentry.workflow_engine.models import BulkJobStatus, BulkJobState

# Check status
pending = BulkJobStatus.objects.filter(
    job_type="my_job_type",
    status=BulkJobState.NOT_STARTED
).count()

in_progress = BulkJobStatus.objects.filter(
    job_type="my_job_type",
    status=BulkJobState.IN_PROGRESS
).count()

completed = BulkJobStatus.objects.filter(
    job_type="my_job_type",
    status=BulkJobState.COMPLETED
).count()
```

### Key Features

- **Automatic Deduplication**: Uses `batch_key` to prevent duplicate job records
- **Resumable Population**: `populate` can be interrupted and resumed via `start_from`
- **Concurrency Control**: Coordinator maintains `target_running_tasks` concurrent jobs
- **Automatic Retry**: Stuck jobs (in progress > timeout) are automatically reset
- **Cleanup**: Completed jobs older than `completed_cleanup_age` are auto-deleted
- **Metrics**: Automatic metrics reporting with job_type tags

For a complete example, see `src/sentry/workflow_engine/processors/error_backfill.py`
and the integration tests in `tests/sentry/workflow_engine/test_bulk_job_integration.py`.
"""

import logging
from abc import ABC, abstractmethod
from collections.abc import Callable, Iterable
from datetime import UTC, datetime, timedelta
from typing import Any

from pydantic import BaseModel

from sentry.utils import metrics
from sentry.utils.registry import Registry
from sentry.workflow_engine.models import BulkJobState, BulkJobStatus

logger = logging.getLogger(__name__)


class BulkJobSpec(ABC):
    """
    Abstract base class for bulk job specifications.

    Subclasses must define job_type and work_chunk_model as class attributes,
    and implement all abstract methods to define job-specific behavior.
    """

    job_type: str
    work_chunk_model: type[BaseModel]

    # Coordination configuration
    max_batch_size: int = 100
    target_running_tasks: int = 50
    in_progress_timeout: timedelta = timedelta(hours=1)
    completed_cleanup_age: timedelta = timedelta(days=30)

    @abstractmethod
    def process_work_chunk(self, work_chunk: BaseModel) -> dict[str, Any]:
        """Process a single work chunk and return result metadata for logging."""
        pass

    @abstractmethod
    def generate_work_chunks(self, start_from: str | None) -> Iterable[BaseModel]:
        """Generate work chunks for job status record creation."""
        pass

    @abstractmethod
    def get_batch_key(self, work_chunk: BaseModel) -> str:
        """Get the unique batch key for a work chunk."""
        pass


# Registry of all bulk job specs
bulk_job_registry: Registry[BulkJobSpec] = Registry(enable_reverse_lookup=False)


def process_bulk_job(job_status_id: int) -> None:
    """
    Generic processor for any bulk job type.

    Looks up the job spec from the registry and executes the job-specific processing logic.
    """
    try:
        job_status = BulkJobStatus.objects.select_for_update().get(id=job_status_id)
    except BulkJobStatus.DoesNotExist:
        logger.warning(
            "bulk_job.status_not_found",
            extra={"job_status_id": job_status_id},
        )
        return

    try:
        job_spec = bulk_job_registry.get(job_status.job_type)
    except Exception:
        logger.exception(
            "bulk_job.unknown_job_type",
            extra={"job_status_id": job_status_id, "job_type": job_status.job_type},
        )
        return

    if job_status.status != BulkJobState.IN_PROGRESS:
        job_status.status = BulkJobState.IN_PROGRESS
        job_status.save(update_fields=["status", "date_updated"])

    try:
        # Deserialize work chunk using job-specific model
        work_chunk = job_spec.work_chunk_model(**job_status.work_chunk_info)

        # Execute job-specific processing
        result = job_spec.process_work_chunk(work_chunk)

        job_status.status = BulkJobState.COMPLETED
        job_status.save(update_fields=["status", "date_updated"])

        metrics.incr(
            "workflow_engine.bulk_job.process_success", tags={"job_type": job_status.job_type}
        )

        logger.info(
            "bulk_job.completed",
            extra={
                "job_status_id": job_status_id,
                "job_type": job_status.job_type,
                **result,
            },
        )

    except Exception as e:
        logger.exception(
            "bulk_job.failed",
            extra={
                "job_status_id": job_status_id,
                "job_type": job_status.job_type,
                "error": str(e),
            },
        )
        metrics.incr(
            "workflow_engine.bulk_job.process_error", tags={"job_type": job_status.job_type}
        )
        raise


def coordinate_bulk_jobs(
    job_type: str,
    max_batch_size: int,
    in_progress_timeout: timedelta,
    completed_cleanup_age: timedelta,
    schedule_task_fn: Callable[[int], None],
    target_running_tasks: int,
) -> None:
    """
    Generic coordinator for bulk jobs: reset stuck items, delete old completed items,
    and schedule new pending jobs to maintain target concurrency.

    Only schedules enough tasks to bring the current running count up to target_running_tasks.
    """
    stuck_cutoff = datetime.now(UTC) - in_progress_timeout
    stuck_count = BulkJobStatus.objects.filter(
        job_type=job_type,
        status=BulkJobState.IN_PROGRESS,
        date_updated__lt=stuck_cutoff,
    ).update(
        status=BulkJobState.NOT_STARTED,
    )

    if stuck_count > 0:
        logger.info(
            "bulk_job.reset_stuck",
            extra={"count": stuck_count, "job_type": job_type},
        )
        metrics.incr(
            "workflow_engine.bulk_job.reset_stuck", amount=stuck_count, tags={"job_type": job_type}
        )

    completed_cutoff = datetime.now(UTC) - completed_cleanup_age
    deleted_count, _ = BulkJobStatus.objects.filter(
        job_type=job_type,
        status=BulkJobState.COMPLETED,
        date_updated__lt=completed_cutoff,
    ).delete()

    if deleted_count > 0:
        logger.info(
            "bulk_job.cleaned_up",
            extra={"count": deleted_count, "job_type": job_type},
        )
        metrics.incr(
            "workflow_engine.bulk_job.cleaned_up", amount=deleted_count, tags={"job_type": job_type}
        )

    # Count current in-progress tasks
    current_in_progress = BulkJobStatus.objects.filter(
        job_type=job_type, status=BulkJobState.IN_PROGRESS
    ).count()

    # Calculate how many tasks to schedule to reach target
    tasks_to_schedule = max(0, target_running_tasks - current_in_progress)
    # Cap at max_batch_size for safety
    tasks_to_schedule = min(tasks_to_schedule, max_batch_size)

    scheduled_count = 0
    if tasks_to_schedule == 0:
        logger.info(
            "bulk_job.target_reached",
            extra={
                "job_type": job_type,
                "current_in_progress": current_in_progress,
                "target_running_tasks": target_running_tasks,
            },
        )
    else:
        pending_items = BulkJobStatus.objects.filter(
            job_type=job_type,
            status=BulkJobState.NOT_STARTED,
        ).order_by("date_added")[:tasks_to_schedule]

        for item in pending_items:
            try:
                schedule_task_fn(item.id)
                scheduled_count += 1
            except Exception as e:
                logger.exception(
                    "bulk_job.schedule_failed",
                    extra={
                        "job_status_id": item.id,
                        "job_type": job_type,
                        "error": str(e),
                    },
                )

        if scheduled_count > 0:
            logger.info(
                "bulk_job.scheduled",
                extra={"count": scheduled_count, "job_type": job_type},
            )
            metrics.incr(
                "workflow_engine.bulk_job.scheduled",
                amount=scheduled_count,
                tags={"job_type": job_type},
            )

    total_pending = BulkJobStatus.objects.filter(
        job_type=job_type, status=BulkJobState.NOT_STARTED
    ).count()
    total_in_progress = BulkJobStatus.objects.filter(
        job_type=job_type, status=BulkJobState.IN_PROGRESS
    ).count()
    total_completed = BulkJobStatus.objects.filter(
        job_type=job_type, status=BulkJobState.COMPLETED
    ).count()

    logger.info(
        "bulk_job.coordinator_run",
        extra={
            "job_type": job_type,
            "scheduled": scheduled_count,
            "stuck_reset": stuck_count,
            "cleaned_up": deleted_count,
            "total_pending": total_pending,
            "total_in_progress": total_in_progress,
            "total_completed": total_completed,
        },
    )

    metrics.gauge("workflow_engine.bulk_job.pending", total_pending, tags={"job_type": job_type})
    metrics.gauge(
        "workflow_engine.bulk_job.in_progress", total_in_progress, tags={"job_type": job_type}
    )
    metrics.gauge(
        "workflow_engine.bulk_job.completed", total_completed, tags={"job_type": job_type}
    )


def create_bulk_job_records(
    job_type: str,
    start_from: str | None = None,
    deadline: datetime | None = None,
    batch_size: int = 1000,
) -> str | None:
    """
    Create BulkJobStatus records for a bulk job type.

    Returns a resume key if the deadline is reached, or None if complete.
    """
    try:
        job_spec = bulk_job_registry.get(job_type)
    except Exception:
        logger.exception(
            "bulk_job.unknown_job_type",
            extra={"job_type": job_type},
        )
        return None

    created_count = 0
    work_chunk_batch: list[BaseModel] = []

    for work_chunk in job_spec.generate_work_chunks(start_from):
        work_chunk_batch.append(work_chunk)

        if deadline and datetime.now(UTC) >= deadline:
            resume_key = job_spec.get_batch_key(work_chunk)
            logger.info(
                "bulk_job.populate_deadline_reached",
                extra={
                    "job_type": job_type,
                    "created_count": created_count,
                    "resume_from": resume_key,
                },
            )
            metrics.incr(
                "workflow_engine.bulk_job.populated",
                amount=created_count,
                tags={"job_type": job_type},
            )
            return resume_key

        if len(work_chunk_batch) >= batch_size:
            created_count += _create_job_records_batch(job_type, job_spec, work_chunk_batch)
            work_chunk_batch = []

    if work_chunk_batch:
        created_count += _create_job_records_batch(job_type, job_spec, work_chunk_batch)

    logger.info(
        "bulk_job.populated",
        extra={"job_type": job_type, "created_count": created_count},
    )

    metrics.incr(
        "workflow_engine.bulk_job.populated", amount=created_count, tags={"job_type": job_type}
    )
    return None


def _create_job_records_batch(
    job_type: str, job_spec: BulkJobSpec, work_chunks: list[BaseModel]
) -> int:
    """
    Create BulkJobStatus records for a batch of work chunks.

    Returns the number of new records created.
    """
    batch_keys = {job_spec.get_batch_key(chunk) for chunk in work_chunks}

    existing_keys = set(
        BulkJobStatus.objects.filter(job_type=job_type, batch_key__in=batch_keys).values_list(
            "batch_key", flat=True
        )
    )

    new_records = []
    for chunk in work_chunks:
        batch_key = job_spec.get_batch_key(chunk)
        if batch_key not in existing_keys:
            record = BulkJobStatus(
                job_type=job_type,
                batch_key=batch_key,
                work_chunk_info=chunk.dict(),
                status=BulkJobState.NOT_STARTED,
            )
            new_records.append(record)

    if new_records:
        BulkJobStatus.objects.bulk_create(new_records, ignore_conflicts=True)
        return len(new_records)
    return 0
