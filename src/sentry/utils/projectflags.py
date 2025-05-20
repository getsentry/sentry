from typing import TYPE_CHECKING

from django.db.models import F
from django.dispatch import Signal

if TYPE_CHECKING:
    from sentry.models.project import Project


def set_project_flag_and_signal(
    project: "Project", flag_name: str, signal: Signal, **kwargs
) -> int:
    """Helper function to set a project flag and send a signal."""
    from sentry.models.project import Project

    flag = getattr(Project.flags, flag_name)

    # if the flag is already set, we don't need to do anything
    # and we can return early
    if getattr(project.flags, flag_name):
        return 0

    setattr(project.flags, flag_name, True)
    updated = project.update(flags=F("flags").bitor(flag))
    signal.send_robust(project=project, sender=Project, **kwargs)
    return updated
