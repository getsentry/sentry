from __future__ import annotations
from typing import int

import logging

from sentry.integrations.source_code_management.tasks import pr_comment_workflow
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import integrations_tasks

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.integrations.github.tasks.github_comment_workflow",
    namespace=integrations_tasks,
    silo_mode=SiloMode.REGION,
)
def github_comment_workflow(pullrequest_id: int, project_id: int) -> None:
    # TODO(jianyuan): Using `sentry.integrations.source_code_management.tasks.pr_comment_workflow` now.
    # Keep this task temporarily to avoid breaking changes.
    pr_comment_workflow(pr_id=pullrequest_id, project_id=project_id)
