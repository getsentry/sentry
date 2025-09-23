import random
import time
from datetime import UTC, datetime
from typing import Any

from django.db import router, transaction
from google.api_core.exceptions import RetryError

from sentry.eventstream.base import GroupState
from sentry.locks import locks
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.taskworker import config, namespaces
from sentry.taskworker.retry import Retry, retry_task
from sentry.utils import metrics
from sentry.utils.locking import UnableToAcquireLock
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.processors.workflow import process_workflows
from sentry.workflow_engine.tasks.utils import (
    EventNotFoundError,
    build_workflow_event_data_from_event,
)
from sentry.workflow_engine.types import WorkflowEventData
from sentry.workflow_engine.utils import log_context, scopedstats
from sentry.workflow_engine.utils.sentry_level_utils import quiet_redis_noise

logger = log_context.get_logger(__name__)


@instrumented_task(
    name="sentry.workflow_engine.tasks.process_workflow_activity",
    queue="workflow_engine.process_workflows",
    acks_late=True,
    default_retry_delay=5,
    max_retries=3,
    soft_time_limit=50,
    time_limit=60,
    silo_mode=SiloMode.REGION,
    taskworker_config=config.TaskworkerConfig(
        namespace=namespaces.workflow_engine_tasks,
        processing_deadline_duration=60,
        retry=Retry(
            times=3,
            delay=5,
        ),
    ),
)
@retry
def process_workflow_activity(activity_id: int, group_id: int, detector_id: int) -> None:
    """
    Process a workflow task identified by the given activity, group, and detector.

    The task will get the Activity from the database, create a WorkflowEventData object,
    and then process the data in `process_workflows`.
    """
    from sentry.workflow_engine.buffer.batch_client import DelayedWorkflowClient

    with transaction.atomic(router.db_for_write(Detector)):
        try:
            activity = Activity.objects.get(id=activity_id)
            group = Group.objects.get(id=group_id)
            detector = Detector.objects.get(id=detector_id)
        except (Activity.DoesNotExist, Group.DoesNotExist, Detector.DoesNotExist):
            logger.exception(
                "Unable to fetch data to process workflow activity",
                extra={
                    "activity_id": activity_id,
                    "group_id": group_id,
                    "detector_id": detector_id,
                },
            )
            return  # Exit execution that we cannot recover from

    event_data = WorkflowEventData(
        event=activity,
        group=group,
    )
    with quiet_redis_noise():
        batch_client = DelayedWorkflowClient()
        process_workflows(
            batch_client, event_data, event_start_time=activity.datetime, detector=detector
        )
    metrics.incr(
        "workflow_engine.tasks.process_workflows.activity_update.executed",
        tags={"activity_type": activity.type, "detector_type": detector.type},
        sample_rate=1.0,
    )


@instrumented_task(
    name="sentry.workflow_engine.tasks.process_workflows_event",
    queue="workflow_engine.process_workflows",
    acks_late=True,
    default_retry_delay=5,
    max_retries=3,
    soft_time_limit=50,
    time_limit=60,
    silo_mode=SiloMode.REGION,
    taskworker_config=config.TaskworkerConfig(
        namespace=namespaces.workflow_engine_tasks,
        processing_deadline_duration=60,
        retry=Retry(
            times=3,
            delay=5,
        ),
    ),
)
@retry(timeouts=True, exclude=EventNotFoundError, ignore=Group.DoesNotExist)
def process_workflows_event(
    project_id: int,
    event_id: str,
    group_id: int,
    occurrence_id: str | None,
    group_state: GroupState,
    has_reappeared: bool,
    has_escalated: bool,
    start_timestamp_seconds: float | None = None,
    **kwargs: dict[str, Any],
) -> None:
    from sentry.workflow_engine.buffer.batch_client import DelayedWorkflowClient

    recorder = scopedstats.Recorder()
    start_time = time.time()
    with recorder.record():
        try:
            event_data = build_workflow_event_data_from_event(
                project_id=project_id,
                event_id=event_id,
                group_id=group_id,
                occurrence_id=occurrence_id,
                group_state=group_state,
                has_reappeared=has_reappeared,
                has_escalated=has_escalated,
            )
        except RetryError as e:
            # We want to quietly retry these.
            retry_task(e)

        event_start_time = (
            datetime.fromtimestamp(start_timestamp_seconds, tz=UTC)
            if start_timestamp_seconds
            else datetime.now(tz=UTC)
        )
        with quiet_redis_noise():
            batch_client = DelayedWorkflowClient()
            process_workflows(batch_client, event_data, event_start_time=event_start_time)
    duration = time.time() - start_time
    is_slow = duration > 1.0
    # We want full coverage for particularly slow cases, plus a random sampling.
    if is_slow or random.random() < 0.0001:
        stats = recorder.get_result()
        logger.info(
            "workflow_engine.tasks.process_workflows.scopedstats",
            extra={
                "is_slow": is_slow,
                "stats": stats,
                "duration": duration,
            },
        )

    metrics.incr("workflow_engine.tasks.process_workflow_task_executed", sample_rate=1.0)


@instrumented_task(
    name="sentry.workflow_engine.tasks.workflows.schedule_delayed_workflows",
    queue="workflow_engine.process_workflows",
    taskworker_config=config.TaskworkerConfig(
        namespace=namespaces.workflow_engine_tasks,
        processing_deadline_duration=40,
    ),
)
def schedule_delayed_workflows(**kwargs: Any) -> None:
    """
    Schedule delayed workflow buffers in a batch.
    """
    from sentry.workflow_engine.buffer.batch_client import DelayedWorkflowClient
    from sentry.workflow_engine.processors.schedule import process_buffered_workflows

    lock_name = "schedule_delayed_workflows"
    lock = locks.get(f"workflow_engine:{lock_name}", duration=60, name=lock_name)

    try:
        with lock.acquire():
            with quiet_redis_noise():
                process_buffered_workflows(DelayedWorkflowClient())
    except UnableToAcquireLock as error:
        logger.warning("schedule_delayed_workflows.fail", extra={"error": error})
