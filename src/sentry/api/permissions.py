from __future__ import absolute_import

from rest_framework.exceptions import PermissionDenied

from sentry.constants import MEMBER_USER
from sentry.models import Team, Project, User


def has_perm(object, user, project_key, access=MEMBER_USER):
    if not project_key and user.is_superuser:
        return True

    # TODO: abstract this into a permission registry
    if type(object) == User:
        return object == user

    if type(object) == Team:
        if project_key:
            return object == project_key.project.team and access == MEMBER_USER
        return object.slug in Team.objects.get_for_user(user, access=access)

    if hasattr(object, 'project'):
        object = object.project

    if type(object) == Project:
        if project_key:
            return object == project_key.project and access == MEMBER_USER

        return any(
            object == o
            for o in Project.objects.get_for_user(user, access=access)
        )

    raise TypeError(type(object))


def assert_perm(*args, **kwargs):
    if not has_perm(*args, **kwargs):
        raise PermissionDenied
