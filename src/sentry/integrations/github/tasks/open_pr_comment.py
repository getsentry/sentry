from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.tasks.integrations.github.open_pr_comment import (
    open_pr_comment_workflow as open_pr_comment_workflow_old,
)


@instrumented_task(
    name="sentry.integrations.github.tasks.open_pr_comment_workflow", silo_mode=SiloMode.REGION
)
def open_pr_comment_workflow(pr_id: int) -> None:
    open_pr_comment_workflow_old(pr_id)
