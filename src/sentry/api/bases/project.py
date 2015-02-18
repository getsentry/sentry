from __future__ import absolute_import

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
            return request.auth.organization_id == project.organization_id
        return project.has_access(request.user, self.access_map[request.method])


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
