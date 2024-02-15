from __future__ import annotations

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.sentry_metrics.client import generic_metrics_backend
from sentry.sentry_metrics.use_case_id_registry import UseCaseID

MINUTE = 60  # 60 seconds


@region_silo_endpoint
class BundleAnalysisEndpoint(ProjectEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (ProjectReleasePermission,)

    def post(self, request: Request, project) -> Response:
        total_size = request.GET.get("total_size")
        org_id = project.organization_id
        project_id = project.id
        generic_metrics_backend.distribution(
            UseCaseID.BUNDLE_ANALYSIS,
            org_id=org_id,
            project_id=project_id,
            metric_name="bundle_size",
            value=[int(total_size)],
            tags={"type": "total"},
            unit="byte",
        )

        return Response({"data": "Bundle size metric added"}, status=200)
