from __future__ import absolute_import

from sentry.auth import access
from sentry.api.base import Endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.permissions import ScopedPermission
from sentry.models import Project


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

        request.access = access.from_request(request, project.organization)

        for scope in self.scope_map.get(request.method, []):
            if request.access.has_team_scope(project.team, scope):
                return True
        return False


class ProjectEventPermission(ProjectPermission):
    scope_map = {
        'GET': ['event:read', 'event:write', 'event:delete'],
        'POST': ['event:write', 'event:delete'],
        'PUT': ['event:write', 'event:delete'],
        'DELETE': ['event:delete'],
    }


class ProjectEndpoint(Endpoint):
    permission_classes = (ProjectPermission,)

    def convert_args(self, request, organization_slug, project_slug, *args, **kwargs):
        try:
            project = Project.objects.get_from_cache(
                organization__slug=organization_slug,
                slug=project_slug,
            )
        except Project.DoesNotExist:
            raise ResourceDoesNotExist

        self.check_object_permissions(request, project)

        kwargs['project'] = project
        return (args, kwargs)
