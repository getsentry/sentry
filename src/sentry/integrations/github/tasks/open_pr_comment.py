from __future__ import annotations

import logging

from sentry.integrations.source_code_management.commit_context import run_open_pr_comment_workflow
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import integrations_tasks

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.integrations.github.tasks.open_pr_comment_workflow",
    silo_mode=SiloMode.REGION,
    taskworker_config=TaskworkerConfig(
        namespace=integrations_tasks,
    ),
)
def open_pr_comment_workflow(pr_id: int) -> None:
    run_open_pr_comment_workflow(integration_name="github", pullrequest_id=pr_id)
