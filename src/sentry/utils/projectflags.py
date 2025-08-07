from __future__ import annotations

from typing import Any

from django.db.models import F
from django.dispatch import Signal

from sentry.models.project import Project


def set_project_flag_and_signal(
    project: Project, flag_name: str, signal: Signal, **kwargs: Any
) -> bool:
    """
    Helper function to set a project flag and send a signal.
    Returns True if the flag was set, False if it was already set.
    """
    flag = getattr(Project.flags, flag_name)

    # if the flag is already set, we don't need to do anything
    # and we can return early
    if getattr(project.flags, flag_name):
        return False

    setattr(project.flags, flag_name, True)
    updated = project.update(flags=F("flags").bitor(flag))
    signal.send_robust(project=project, sender=Project, **kwargs)
    return bool(updated)
