from __future__ import annotations

from typing import int, Any

from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.taskworker.namespaces import workflow_engine_tasks
from sentry.taskworker.retry import Retry
from sentry.utils.exceptions import quiet_redis_noise
from sentry.workflow_engine.utils import log_context

logger = log_context.get_logger("sentry.workflow_engine.tasks.delayed_workflows")


@instrumented_task(
    name="sentry.workflow_engine.tasks.delayed_workflows",
    namespace=workflow_engine_tasks,
    processing_deadline_duration=60,
    retry=Retry(times=5, delay=5),
    silo_mode=SiloMode.REGION,
)
@retry(timeouts=True)
@log_context.root()
def process_delayed_workflows(
    project_id: int, batch_key: str | None = None, *args: Any, **kwargs: Any
) -> None:
    """
    Grab workflows, groups, and data condition groups from the Redis buffer, evaluate the "slow" conditions in a bulk snuba query, and fire them if they pass
    """
    from sentry.workflow_engine.buffer.batch_client import DelayedWorkflowClient
    from sentry.workflow_engine.processors.delayed_workflow import (
        process_delayed_workflows as _process_delayed_workflows,
    )

    log_context.add_extras(project_id=project_id)
    batch_client = DelayedWorkflowClient()

    with quiet_redis_noise():
        _process_delayed_workflows(batch_client, project_id, batch_key)
