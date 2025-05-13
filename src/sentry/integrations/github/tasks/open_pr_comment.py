from __future__ import annotations

import logging

from sentry.integrations.source_code_management.tasks import (
    open_pr_comment_workflow as real_open_pr_comment_workflow,
)
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
    # TODO(jianyuan): Using `sentry.integrations.source_code_management.tasks.open_pr_comment_workflow` now.
    # Keep this task temporarily to avoid breaking changes.
    real_open_pr_comment_workflow(pr_id)
