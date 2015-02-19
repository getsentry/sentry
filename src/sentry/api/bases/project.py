from __future__ import absolute_import

from django.db.models import Q

from sentry.api.base import Endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.permissions import ScopedPermission
from sentry.models import OrganizationMember, Project


class ProjectPermission(ScopedPermission):
    scope_map = {
        'GET': ['project:read', 'project:write', 'project:delete'],
        'POST': ['project:write', 'project:delete'],
        'PUT': ['project:write', 'project:delete'],
        'DELETE': ['project:delete'],
    }

    def has_object_permission(self, request, view, project):
        if request.auth:
            if self.is_project_key(request):
                return request.auth.project_id == project.id
            return request.auth.organization_id == project.organization_id

        if request.user.is_superuser:
            return True

        try:
            om = OrganizationMember.objects.get(
                Q(has_global_access=True) | Q(teams=project.team_id),
                organization=project.organization_id,
                user=request.user,
            )
        except OrganizationMember.DoesNotExist:
            return False

        allowed_scopes = set(self.scope_map[request.method])
        current_scopes = om.scopes
        return any(s in allowed_scopes for s in current_scopes)


class ProjectEventPermission(ProjectPermission):
    scope_map = {
        'GET': ['event:read', 'event:write', 'event:delete'],
        'POST': ['event:write', 'event:delete'],
        'PUT': ['event:write', 'event:delete'],
        'DELETE': ['event:delete'],
    }


class ProjectEndpoint(Endpoint):
    permission_classes = (ProjectPermission,)

    def convert_args(self, request, project_id, *args, **kwargs):
        try:
            project = Project.objects.get_from_cache(
                id=project_id,
            )
        except Project.DoesNotExist:
            raise ResourceDoesNotExist

        self.check_object_permissions(request, project)

        kwargs['project'] = project
        return (args, kwargs)
