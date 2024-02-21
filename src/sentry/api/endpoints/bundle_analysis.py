from __future__ import annotations

from datetime import datetime, timedelta

from rest_framework.request import Request
from rest_framework.response import Response
from snuba_sdk.expressions import Granularity

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.models.project import Project
from sentry.sentry_metrics.client import generic_metrics_backend
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.metrics import MetricField, MetricGroupByField, MetricsQuery, get_series
from sentry.snuba.metrics.naming_layer.mri import BundleAnalysisMRI
from sentry.utils import json

MINUTE = 60  # 60 seconds


@region_silo_endpoint
class BundleAnalysisEndpoint(ProjectEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (ProjectReleasePermission,)

    def get(self, request: Request, project: Project) -> Response:
        result = self._get_bundle_trend(project)
        return Response({"data": self._parse_result(result)}, status=200)

    def _parse_result(self, result):
        intervals: list[datetime] = result["intervals"]
        bundles: list[str] = map(lambda x: x["by"]["bundle_name"], result["groups"])
        bundles_dict = dict.fromkeys(bundles, [])

        rows = []
        for i in range(len(intervals)):
            for bundle in result["groups"]:
                bundle_name = bundle["by"]["bundle_name"]
                # wip code type = bundle["by"]["type"]
                bundle_size = bundle["bundle_size"][i]
                if bundle_size is None:
                    bundle_size = 0
                bundles_dict[bundle_name].append(bundle_size)
            return rows

    def _get_bundle_trend(
        self,
        project: Project,
    ):
        metrics_query = self._generate_generic_metrics_backend_query(
            project.organization_id, project.id
        )
        get_series(
            projects=[project],
            metrics_query=metrics_query,
            use_case_id=UseCaseID.BUNDLE_ANALYSIS,
            include_meta=True,
        )

    def _generate_generic_metrics_backend_query(self, organization_id: int, project_id: int):

        select = [
            MetricField(
                metric_mri=BundleAnalysisMRI.BUNDLE_SIZE.value, alias="bundle_size", op="avg"
            ),
        ]

        groupby = [
            MetricGroupByField(field="type"),
            MetricGroupByField(field="bundle_name"),
        ]

        return MetricsQuery(
            org_id=organization_id,
            project_ids=[project_id],
            select=select,
            groupby=groupby,
            granularity=Granularity(MINUTE),
            start=datetime.now() - timedelta(hours=1),
            end=datetime.now(),
            include_totals=False,
        )

    def post(self, request: Request, project) -> Response:
        data = json.loads(request.body)
        total_size = data.get("total_size")
        js_size = data.get("javascript_size")
        css_size = data.get("css_size")
        img_size = data.get("image_size")
        font_size = data.get("font_size")
        bundle_name = data.get("bundle_name")
        environment = data.get("environment")

        if (
            not total_size
            or not js_size
            or not css_size
            or not img_size
            or not font_size
            or not bundle_name
        ):
            return Response({"error": "Please provide all the required parameters"}, status=400)

        self._add_bundle_size_metric(project, "total", total_size, bundle_name, environment)
        self._add_bundle_size_metric(project, "javascript", js_size, bundle_name, environment)
        self._add_bundle_size_metric(project, "css", css_size, bundle_name, environment)
        self._add_bundle_size_metric(project, "image", img_size, bundle_name, environment)
        self._add_bundle_size_metric(project, "font", font_size, bundle_name, environment)

        return Response({"data": "Bundle size metric added"}, status=200)

    def _add_bundle_size_metric(self, project, type, size, bundle_name, environment=None):
        tags = {"type": type, "bundle_name": bundle_name}
        if environment:
            tags["environment"] = environment

        org_id = project.organization_id
        project_id = project.id
        generic_metrics_backend.distribution(
            UseCaseID.BUNDLE_ANALYSIS,
            org_id=org_id,
            project_id=project_id,
            metric_name="bundle_size",
            value=[size],
            tags=tags,
            unit="byte",
        )
