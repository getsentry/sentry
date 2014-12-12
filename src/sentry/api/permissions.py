from __future__ import absolute_import

from rest_framework.exceptions import PermissionDenied

from sentry.models import (
    Organization, OrganizationMember, OrganizationMemberType, Project, Team, User
)


def has_perm(object, user, project_key, access=OrganizationMemberType.MEMBER):
    if not project_key and user.is_superuser:
        return True

    # TODO: abstract this into a permission registry
    if type(object) == User:
        return object == user

    if type(object) == Team:
        if project_key:
            return object == project_key.project.team and access == OrganizationMemberType.MEMBER
        return object in Team.objects.get_for_user(
            organization=object.organization,
            user=user,
            access=access
        )

    if type(object) == Organization:
        return OrganizationMember.objects.filter(
            organization=object,
            type__lte=access,
            user=user,
        ).exists()

    if hasattr(object, 'project'):
        object = object.project

    if type(object) == Project:
        if project_key:
            return object == project_key.project and access == OrganizationMemberType.MEMBER
        return object in Project.objects.get_for_user(
            team=object.team,
            user=user,
            access=access,
        )

    raise TypeError(type(object))


def assert_perm(*args, **kwargs):
    if not has_perm(*args, **kwargs):
        raise PermissionDenied
