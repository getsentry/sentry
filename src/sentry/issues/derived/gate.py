from django.contrib.auth.models import AnonymousUser

from sentry import features
from sentry.models.options.project_option import ProjectOption
from sentry.models.project import Project
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser

# ProjectOption key whose value tracks group action-log backfill state:
# true means complete, false means pending, and a missing option means not yet scheduled.
GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION = "sentry:group_action_log_backfill_completed"


def is_backfilled(project: Project) -> bool:
    return (
        ProjectOption.objects.get_value(project, GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION) is True
    )


def derived_should_be_correct(project: Project) -> bool:
    """
    The project is backfilled and writing actions, so derived data should cover its full history.

    It may still be wrong, but checking it and surfacing it should be reasonable.
    """
    return features.has("projects:issue-action-log-write-to-db", project) and is_backfilled(project)


def should_serve_action_log_activity(
    project: Project,
    actor: User | RpcUser | AnonymousUser | None = None,
) -> bool:
    """Whether the action log can back this project's Activity-shaped responses."""
    return features.has(
        "projects:issue-action-log-activity", project, actor=actor
    ) and derived_should_be_correct(project)
