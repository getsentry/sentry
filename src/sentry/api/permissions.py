from sentry.constants import MEMBER_USER
from sentry.models import Team, Project, User


class PermissionError(Exception):
    pass


def has_perm(object, user, access=MEMBER_USER):
    if user.is_superuser:
        return True

    # TODO: abstract this into a permission registry
    if type(object) == User:
        return object == user

    if type(object) == Team:
        return object.slug in Team.objects.get_for_user(user, access=access)

    if hasattr(object, 'project'):
        object = object.project

    if type(object) == Project:
        return any(
            object == o
            for o in Project.objects.get_for_user(user, access=access)
        )

    raise TypeError(type(object))


def assert_perm(*args, **kwargs):
    if not has_perm(*args, **kwargs):
        raise PermissionError
