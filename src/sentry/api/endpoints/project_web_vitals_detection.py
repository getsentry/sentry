from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.models.project import Project
from sentry.tasks.web_vitals_issue_detection import dispatch_detection_for_project_ids


@region_silo_endpoint
class ProjectWebVitalsDetectionEndpoint(ProjectEndpoint):
    owner = ApiOwner.DATA_BROWSING
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, project: Project) -> Response:
        results = dispatch_detection_for_project_ids([project.id])
        if project.id not in results:
            return Response({"status": "invalid_project"}, status=status.HTTP_400_BAD_REQUEST)
        if results[project.id].get("success", False):
            return Response({"status": "dispatched"}, status=status.HTTP_202_ACCEPTED)
        return Response(
            {"status": results[project.id].get("reason", "rejected")},
            status=status.HTTP_400_BAD_REQUEST,
        )
