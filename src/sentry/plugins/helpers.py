from __future__ import annotations

from sentry import options
from sentry.models.options.project_option import ProjectOption
from sentry.models.options.user_option import UserOption
from sentry.models.project import Project
from sentry.services.hybrid_cloud.project import RpcProject, project_service

__all__ = ("set_option", "get_option", "unset_option")


def reset_options(prefix, project=None, user=None):
    if user:
        UserOption.objects.filter(
            key__startswith=f"{prefix}:", project_id=project.id if project else None, user=user
        ).delete()
        UserOption.objects.clear_cache()
    elif project:
        ProjectOption.objects.filter(key__startswith=f"{prefix}:", project=project).delete()
        ProjectOption.objects.clear_local_cache()
    else:
        raise NotImplementedError


def set_option(key, value, project: Project | RpcProject | None = None, user=None) -> None:
    if user:
        UserOption.objects.set_value(user=user, key=key, value=value, project=project)
    elif project:
        if isinstance(project, RpcProject):
            project_service.update_option(project=project, key=key, value=value)
        else:
            ProjectOption.objects.set_value(project, key, value)
    else:
        raise NotImplementedError


def get_option(key, project: Project | RpcProject | None = None, user=None):
    if user:
        result = UserOption.objects.get_value(user, key, project=project)
    elif project:
        if isinstance(project, RpcProject):
            result = project_service.get_option(project=project, key=key)
        else:
            result = ProjectOption.objects.get_value(project, key, None)
    else:
        result = options.get(key)

    return result


def unset_option(key, project=None, user=None) -> None:
    if user:
        UserOption.objects.unset_value(user, project, key)
    elif project:
        ProjectOption.objects.unset_value(project, key)
    else:
        raise NotImplementedError
