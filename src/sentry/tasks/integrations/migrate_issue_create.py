# from sentry.models import ProjectOption
from sentry.tasks.base import instrumented_task

# from sentry.tasks.integrations import logger


@instrumented_task(
    name="sentry.tasks.integrations.migrate_issue_create",
    queue="integrations",
    default_retry_delay=60 * 5,
    max_retries=5,
)
def migrate_issue_create(
    integration_id: int, organization_id: int, project_id: int, plugin_slug: str
) -> None:
    pass
    # TODO create alert rule using plugin project options if auto_create is set to True
    # look up default project in Jira client and ensure it's still there
    # ensure issue type
    # ensure each other project option is in the issue type meta
    # this will differ for jira / jira server
