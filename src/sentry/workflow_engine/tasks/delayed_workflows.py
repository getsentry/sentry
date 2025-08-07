from __future__ import annotations

from typing import Any

from celery import Task

from sentry import options
from sentry.rules.processing.buffer_processing import (
    BufferHashKeys,
    DelayedProcessingBase,
    FilterKeys,
    delayed_processing_registry,
)
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import workflow_engine_tasks
from sentry.taskworker.retry import Retry
from sentry.workflow_engine.models import Workflow
from sentry.workflow_engine.processors.workflow import WORKFLOW_ENGINE_BUFFER_LIST_KEY
from sentry.workflow_engine.utils import log_context

logger = log_context.get_logger("sentry.workflow_engine.tasks.delayed_workflows")


@instrumented_task(
    name="sentry.workflow_engine.processors.process_delayed_workflows",
    queue="delayed_rules",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=50,
    time_limit=60,
    silo_mode=SiloMode.REGION,
    taskworker_config=TaskworkerConfig(
        namespace=workflow_engine_tasks,
        processing_deadline_duration=60,
        retry=Retry(
            times=5,
            delay=5,
        ),
    ),
)
@retry(timeouts=True)
@log_context.root()
def process_delayed_workflows_shim(
    project_id: int, batch_key: str | None = None, *args: Any, **kwargs: Any
) -> None:
    from sentry.workflow_engine.processors.delayed_workflow import process_delayed_workflows

    process_delayed_workflows(project_id, batch_key, *args, **kwargs)


@delayed_processing_registry.register("delayed_workflow")
class DelayedWorkflow(DelayedProcessingBase):
    buffer_key = WORKFLOW_ENGINE_BUFFER_LIST_KEY
    option = "delayed_workflow.rollout"

    @property
    def hash_args(self) -> BufferHashKeys:
        return BufferHashKeys(model=Workflow, filters=FilterKeys(project_id=self.project_id))

    @property
    def processing_task(self) -> Task:
        from sentry.workflow_engine.processors.delayed_workflow import process_delayed_workflows

        if options.get("delayed_workflow.use_workflow_engine_pool"):
            return process_delayed_workflows_shim
        return process_delayed_workflows
