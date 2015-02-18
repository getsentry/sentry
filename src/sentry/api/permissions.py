from __future__ import absolute_import

from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied

from sentry.models import (
    Organization, OrganizationMember, OrganizationMemberType, Project,
    ProjectKey, Team, User
)


class NoPermission(permissions.BasePermission):
    def has_permission(self, request, view):
        return False


class ScopedPermission(permissions.BasePermission):
    scope_map = {
        'GET': (),
        'POST': (),
        'PUT': (),
        'PATCH': (),
        'DELETE': (),
    }

    # this is the general mapping of VERB => OrganizationMemberType, it however
    # does not enforce organization-level (i.e. has_global-access) vs project
    # level so that should be done per subclass
    access_map = {
        'GET': None,
        'POST': OrganizationMemberType.ADMIN,
        'PUT': OrganizationMemberType.ADMIN,
        'DELETE': OrganizationMemberType.OWNER,
    }

    def has_permission(self, request, view):
        # session-based auth has all scopes for a logged in user
        if not request.auth:
            return request.user.is_authenticated()

        allowed_scopes = set(self.scope_map[request.method])
        current_scopes = request.auth.scopes
        return any(s in allowed_scopes for s in current_scopes)

    def has_object_permission(self, request, view, obj):
        return False

    def is_project_key(self, request):
        return isinstance(request.auth, ProjectKey)


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
