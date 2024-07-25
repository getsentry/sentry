from __future__ import annotations

from sentry.integrations.github.tasks.pr_comment import (
    github_comment_reactions as new_github_comment_reactions,
)
from sentry.integrations.github.tasks.pr_comment import (
    github_comment_workflow as new_github_comment_workflow,
)
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task


@instrumented_task(
    name="sentry.tasks.integrations.github_comment_workflow", silo_mode=SiloMode.REGION
)
def github_comment_workflow(pullrequest_id: int, project_id: int):
    new_github_comment_workflow(pullrequest_id=pullrequest_id, project_id=project_id)


@instrumented_task(
    name="sentry.tasks.integrations.github_comment_reactions", silo_mode=SiloMode.REGION
)
def github_comment_reactions():
    new_github_comment_reactions()
