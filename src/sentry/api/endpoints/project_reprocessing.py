from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.reprocessing import trigger_reprocessing


class ProjectReprocessingEndpoint(ProjectEndpoint):
    permission_classes = (ProjectReleasePermission,)

    def post(self, request: Request, project) -> Response:
        """
        Triggers the reprocessing process as a task
        """
        trigger_reprocessing(project)
        return Response(status=200)
