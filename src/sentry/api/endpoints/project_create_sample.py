from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.utils.samples import create_sample_event


class ProjectCreateSampleEndpoint(ProjectEndpoint):
    def put(self, request, project):
        has_project_write = (
            (request.auth and request.auth.has_scope('project:write')) or
            (request.access and request.access.has_scope('project:write'))
        )

        if has_project_write:
            if project.platform:
                event = create_sample_event(
                    project, platform=project.platform, default='javascript'
                )
            else:
                event = create_sample_event(project, platform='javascript')

            data = serialize(event, request.user)

            return Response(data)
