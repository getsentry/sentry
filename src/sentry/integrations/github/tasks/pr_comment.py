from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.tasks.integrations.github.pr_comment import (
    github_comment_reactions as github_comment_reactions_old,
)
from sentry.tasks.integrations.github.pr_comment import (
    github_comment_workflow as github_comment_workflow_old,
)


@instrumented_task(
    name="sentry.integrations.github.tasks.github_comment_workflow", silo_mode=SiloMode.REGION
)
def github_comment_workflow(pullrequest_id: int, project_id: int):
    github_comment_workflow_old(pullrequest_id=pullrequest_id, project_id=project_id)


@instrumented_task(
    name="sentry.integrations.github.tasks.github_comment_reactions", silo_mode=SiloMode.REGION
)
def github_comment_reactions():
    github_comment_reactions_old()
