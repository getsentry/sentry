from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.api.serializers import serialize
from sentry.utils.samples import create_sample_event


class ProjectCreateSampleEndpoint(ProjectEndpoint):
    permission_classes = (ProjectPermission,)

    def post(self, request, project):
        event = create_sample_event(project, platform=project.platform, default="javascript")

        data = serialize(event, request.user)

        return Response(data)
