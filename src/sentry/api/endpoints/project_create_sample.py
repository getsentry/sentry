from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint, ProjectEventPermission
from sentry.api.serializers import serialize
from sentry.utils.samples import create_sample_event


class ProjectCreateSampleEndpoint(ProjectEndpoint):
    # Members should be able to create sample events.
    # This is the same scope that allows members to view all issues for a project.
    permission_classes = (ProjectEventPermission,)

    def post(self, request, project):
        event = create_sample_event(project, platform=project.platform, default="javascript")

        data = serialize(event, request.user)

        return Response(data)
