from __future__ import absolute_import

from sentry.api.base import Endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.app import raven
from sentry.models import Project, ProjectStatus

from .organization import OrganizationPermission
from .team import has_team_permission


class ProjectPermission(OrganizationPermission):
    scope_map = {
        'GET': ['project:read', 'project:write', 'project:admin'],
        'POST': ['project:write', 'project:admin'],
        'PUT': ['project:write', 'project:admin'],
        'DELETE': ['project:admin'],
    }

    def has_object_permission(self, request, view, project):
        result = super(ProjectPermission,
                       self).has_object_permission(request, view, project.organization)

        if not result:
            return result

        return any(
            has_team_permission(request, team, self.scope_map) for team in project.teams.all()
        )


class StrictProjectPermission(ProjectPermission):
    scope_map = {
        'GET': ['project:write', 'project:admin'],
        'POST': ['project:write', 'project:admin'],
        'PUT': ['project:write', 'project:admin'],
        'DELETE': ['project:admin'],
    }


class ProjectReleasePermission(ProjectPermission):
    scope_map = {
        'GET': ['project:read', 'project:write', 'project:admin', 'project:releases'],
        'POST': ['project:write', 'project:admin', 'project:releases'],
        'PUT': ['project:write', 'project:admin', 'project:releases'],
        'DELETE': ['project:admin', 'project:releases'],
    }


class ProjectEventPermission(ProjectPermission):
    scope_map = {
        'GET': ['event:read', 'event:write', 'event:admin'],
        'POST': ['event:write', 'event:admin'],
        'PUT': ['event:write', 'event:admin'],
        'DELETE': ['event:admin'],
    }


class ProjectSettingPermission(ProjectPermission):
    scope_map = {
        'GET': ['project:read', 'project:write', 'project:admin'],
        'POST': ['project:write', 'project:admin'],
        'PUT': ['project:write', 'project:admin'],
        'DELETE': ['project:write', 'project:admin'],
    }


class RelaxedSearchPermission(ProjectPermission):
    scope_map = {
        'GET': ['project:read', 'project:write', 'project:admin'],
        # members can do writes
        'POST': ['project:write', 'project:admin', 'project:read'],
        'PUT': ['project:write', 'project:admin', 'project:read'],
        'DELETE': ['project:admin'],
    }


class ProjectEndpoint(Endpoint):
    permission_classes = (ProjectPermission, )

    def convert_args(self, request, organization_slug, project_slug, *args, **kwargs):
        try:
            project = Project.objects.filter(
                organization__slug=organization_slug,
                slug=project_slug,
            ).select_related('organization').prefetch_related('teams').get()
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
