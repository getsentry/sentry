from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.api.serializers import serialize
from sentry.utils.samples import create_sample_event


class RelaxedProjectPermission(ProjectPermission):
    scope_map = {
        'POST': ['project:write', 'project:admin'],
    }


class ProjectCreateSampleEndpoint(ProjectEndpoint):
    permission_classes = [RelaxedProjectPermission]

    def post(self, request, project):
        has_project_write = (
            (request.auth and request.auth.has_scope('project:write')) or
            (request.access and request.access.has_scope('project:write'))
        )

        if has_project_write:
            if project.platform:
                event = create_sample_event(
                    project, platform=project.platform, default='javascript', level=0
                )
            else:
                event = create_sample_event(project, platform='javascript', level=0)

            data = serialize(event, request.user)

            return Response(data)
