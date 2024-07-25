from __future__ import annotations

from sentry.integrations.github.tasks.open_pr_comment import (
    open_pr_comment_workflow as new_open_pr_comment_workflow,
)
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task


@instrumented_task(
    name="sentry.tasks.integrations.open_pr_comment_workflow", silo_mode=SiloMode.REGION
)
def open_pr_comment_workflow(pr_id: int) -> None:
    new_open_pr_comment_workflow(pr_id=pr_id)
