from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import issues_tasks


@instrumented_task(
    name="sentry.tasks.invalidate_project_issue_owners_cache",
    namespace=issues_tasks,
    processing_deadline_duration=600,
    silo_mode=SiloMode.REGION,
)
def invalidate_project_issue_owners_cache(project_id: int) -> None:
    """
    Invalidate the issue owners debounce cache for all groups in a project.

    This is called asynchronously when CODEOWNERS or ownership rules change,
    allowing groups to re-evaluate ownership on their next event.
    """
    from sentry.models.groupowner import GroupOwner

    GroupOwner.invalidate_debounce_issue_owners_evaluation_cache(project_id)
