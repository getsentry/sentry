from __future__ import absolute_import

from sentry.api.base import Endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.app import raven
from sentry.models import Project, ProjectStatus

from .team import TeamPermission


class ProjectPermission(TeamPermission):
    scope_map = {
        'GET': ['project:read', 'project:write', 'project:delete'],
        'POST': ['project:write', 'project:delete'],
        'PUT': ['project:write', 'project:delete'],
        'DELETE': ['project:delete'],
    }

    def has_object_permission(self, request, view, project):
        return super(ProjectPermission, self).has_object_permission(
            request, view, project.team)


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
        try:
            project = Project.objects.filter(
                organization__slug=organization_slug,
                slug=project_slug,
            ).select_related('organization', 'team').get()
        except Project.DoesNotExist:
            raise ResourceDoesNotExist

        if project.status != ProjectStatus.VISIBLE:
            raise ResourceDoesNotExist

        project.team.organization = project.organization

        self.check_object_permissions(request, project)

        raven.tags_context({
            'project': project.id,
            'organization': project.organization_id,
        })

        kwargs['project'] = project
        return (args, kwargs)
