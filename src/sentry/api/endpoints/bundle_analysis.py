from __future__ import annotations

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.sentry_metrics.client import generic_metrics_backend
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.utils import json

MINUTE = 60  # 60 seconds


@region_silo_endpoint
class BundleAnalysisEndpoint(ProjectEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (ProjectReleasePermission,)

    def post(self, request: Request, project) -> Response:
        data = json.loads(request.body)
        total_size = data.get("total_size")
        js_size = data.get("javascript_size")
        css_size = data.get("css_size")
        img_size = data.get("image_size")
        font_size = data.get("font_size")
        bundle_name = data.get("bundle_name")

        if (
            not total_size
            or not js_size
            or not css_size
            or not img_size
            or not font_size
            or not bundle_name
        ):
            return Response({"error": "Please provide all the required parameters"}, status=400)

        self._add_bundle_size_metric(project, "total", total_size, bundle_name)
        self._add_bundle_size_metric(project, "javascript", js_size, bundle_name)
        self._add_bundle_size_metric(project, "css", css_size, bundle_name)
        self._add_bundle_size_metric(project, "image", img_size, bundle_name)
        self._add_bundle_size_metric(project, "font", font_size, bundle_name)

        return Response({"data": "Bundle size metric added"}, status=200)

    def _add_bundle_size_metric(self, project, type, size, bundle_name):
        org_id = project.organization_id
        project_id = project.id
        generic_metrics_backend.distribution(
            UseCaseID.BUNDLE_ANALYSIS,
            org_id=org_id,
            project_id=project_id,
            metric_name="bundle_size",
            value=[size],
            tags={"type": type, "bundle_name": bundle_name},
            unit="byte",
        )
