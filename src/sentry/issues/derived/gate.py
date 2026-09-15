from django.contrib.auth.models import AnonymousUser

from sentry import features
from sentry.issues.action_log.read_metrics import (
    ActivityReadFallbackReason,
    ActivityReadResult,
    record_activity_read,
)
from sentry.models.options.project_option import ProjectOption
from sentry.models.project import Project
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser

# ProjectOption key whose value tracks group action-log backfill state. True means complete,
# false means pending, and a missing option uses the project's epoch default. Projects created
# after action-log writes became the default resolve to true because they have no history to backfill.
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
    *,
    endpoint: str,
) -> bool:
    """
    Whether the action log can back this project's Activity-shaped responses.

    Records the read outcome itself when it returns False, because only it knows which
    condition closed the gate. Returning True records nothing: the caller goes on to read
    the log, so the caller reports whether that produced anything.
    """
    if not features.has("projects:issue-action-log-activity", project, actor=actor):
        record_activity_read(endpoint, ActivityReadResult.FLAG_OFF)
        return False

    if not derived_should_be_correct(project):
        record_activity_read(
            endpoint, ActivityReadResult.FELL_BACK, ActivityReadFallbackReason.NOT_BACKFILLED
        )
        return False

    return True
