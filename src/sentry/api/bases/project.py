from __future__ import absolute_import

from sentry.api.base import Endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.permissions import ScopedPermission
from sentry.app import raven
from sentry.auth import access
from sentry.models import Project, ProjectStatus
from sentry.models.apikey import ROOT_KEY


class ProjectPermission(ScopedPermission):
    scope_map = {
        'GET': ['project:read', 'project:write', 'project:delete'],
        'POST': ['project:write', 'project:delete'],
        'PUT': ['project:write', 'project:delete'],
        'DELETE': ['project:delete'],
    }

    def has_object_permission(self, request, view, project):
        if request.user and request.user.is_authenticated() and request.auth:
            request.access = access.from_request(
                request, project.organization, scopes=request.auth.get_scopes(),
            )

        elif request.auth:
            if request.auth is ROOT_KEY:
                return True
            return request.auth.organization_id == project.organization_id

        else:
            request.access = access.from_request(request, project.organization)

        allowed_scopes = set(self.scope_map.get(request.method, []))
        return any(
            request.access.has_team_scope(project.team, s)
            for s in allowed_scopes
        )


class ProjectReleasePermission(ProjectPermission):
    scope_map = {
        'GET': ['project:read', 'project:write', 'project:delete', 'project:releases'],
        'POST': ['project:write', 'project:delete', 'project:releases'],
        'PUT': ['project:write', 'project:delete', 'project:releases'],
        'DELETE': ['project:delete', 'project:releases'],
    }


class ProjectEventPermission(ProjectPermission):
    scope_map = {
        'GET': ['event:read', 'event:write', 'event:delete'],
        'POST': ['event:write', 'event:delete'],
        'PUT': ['event:write', 'event:delete'],
        'DELETE': ['event:delete'],
    }


class ProjectSettingPermission(ProjectPermission):
    scope_map = {
        'GET': ['project:read', 'project:write', 'project:delete'],
        'POST': ['project:write', 'project:delete'],
        'PUT': ['project:write', 'project:delete'],
        'DELETE': ['project:write', 'project:delete'],

    }


class ProjectEndpoint(Endpoint):
    permission_classes = (ProjectPermission,)

    def convert_args(self, request, organization_slug, project_slug, *args, **kwargs):
        self.bail_on_xorg(request, slug=organization_slug)
        try:
            project = Project.objects.get_from_cache(
                organization__slug=organization_slug,
                slug=project_slug,
            )
        except Project.DoesNotExist:
            raise ResourceDoesNotExist

        if project.status != ProjectStatus.VISIBLE:
            raise ResourceDoesNotExist

        self.check_object_permissions(request, project)

        raven.tags_context({
            'project': project.id,
            'organization': project.organization_id,
        })

        kwargs['project'] = project
        return (args, kwargs)
