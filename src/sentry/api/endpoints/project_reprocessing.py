from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.reprocessing import trigger_reprocessing


class ProjectReprocessingEndpoint(ProjectEndpoint):
    permission_classes = (ProjectReleasePermission,)

    def post(self, request, project):
        """
        Triggers the reprocessing process as a task
        """
        trigger_reprocessing(project)
        return Response(status=200)
