from __future__ import annotations

from datetime import datetime, timedelta
from enum import Enum

from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.response import Response
from snuba_sdk.expressions import Granularity

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.apidocs.hooks import HTTP_METHOD_NAME
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.sentry_metrics.client import generic_metrics_backend
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.metrics import MetricField, MetricGroupByField, MetricsQuery, get_series
from sentry.snuba.metrics.naming_layer.mri import BundleAnalysisMRI

HOUR = 1000 * 60 * 60


class ResourceSizeType(Enum):
    TOTAL = "total"
    JAVASCRIPT = "javascript"
    CSS = "css"
    FONTS = "fonts"
    IMAGES = "images"


@region_silo_endpoint
class BundleAnalysisEndpoint(ProjectEndpoint):
    publish_status: dict[HTTP_METHOD_NAME, ApiPublishStatus] = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner: ApiOwner = ApiOwner.PERFORMANCE
    permission_classes: tuple[type[BasePermission], ...] = (ProjectReleasePermission,)

    def get(self, request: Request, project: Project) -> Response:
        self._assert_has_feature(request, project.organization)
        serializer = GetBundleStatsSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = self._get_bundle_trend(project)
        return Response({"data": self._parse_result(result)}, status=200)

    def _parse_result(self, result):
        intervals: list[datetime] = result["intervals"]
        bundles: list[str] = map(lambda x: x["by"]["bundle_name"], result["groups"])
        bundles_dict: dict[str, list] = dict.fromkeys(bundles, [])

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
            granularity=Granularity(HOUR),
            start=datetime.now() - timedelta(hours=1),
            end=datetime.now(),
            include_totals=False,
        )

    def post(self, request: Request, project: Project) -> Response:
        self._assert_has_feature(request, project.organization)
        serializer = ListBundleStatsSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = serializer.validated_data

        for stats in result["stats"]:
            bundle_name = stats["bundle_name"]
            self._add_bundle_size_metric(
                project, ResourceSizeType.TOTAL, stats["total_size"], bundle_name
            )
            self._add_bundle_size_metric(
                project, ResourceSizeType.JAVASCRIPT, stats["javascript_size"], bundle_name
            )
            self._add_bundle_size_metric(
                project, ResourceSizeType.CSS, stats["css_size"], bundle_name
            )
            self._add_bundle_size_metric(
                project, ResourceSizeType.FONTS, stats["fonts_size"], bundle_name
            )
            self._add_bundle_size_metric(
                project, ResourceSizeType.IMAGES, stats["images_size"], bundle_name
            )

        return Response({"data": "Bundle size metric added"}, status=200)

    def _assert_has_feature(self, request: Request, organization: Organization) -> None:
        if not self._has_feature(request, organization):
            raise PermissionDenied

    @staticmethod
    def _has_feature(request: Request, organization: Organization) -> bool:
        return features.has(
            "organizations:starfish-browser-resource-module-bundle-analysis",
            organization,
            actor=request.user,
        )

    @staticmethod
    def _add_bundle_size_metric(
        project: Project, type: ResourceSizeType, size: int, bundle_name: str
    ):
        org_id = project.organization_id
        project_id = project.id
        generic_metrics_backend.distribution(
            UseCaseID.BUNDLE_ANALYSIS,
            org_id=org_id,
            project_id=project_id,
            metric_name="bundle_size",
            value=[size],
            tags={"type": type.value, "bundle_name": bundle_name},
            unit="byte",
        )


class GetBundleStatsSerializer(serializers.Serializer):
    statsPeriod = serializers.CharField(required=False)
    start = serializers.DateTimeField(required=False)
    end = serializers.DateTimeField(required=False)

    def validate(self, data):
        hasStatsPeriod = "statsPeriod" in data
        hasStartAndStop = "start" in data and "end" in data

        if not hasStatsPeriod and not hasStartAndStop:
            raise serializers.ValidationError(
                "Either both start and end should be provided or statsPeriod should be provided"
            )
        if hasStartAndStop and data["start"] > data["end"]:
            raise serializers.ValidationError("start must be before end")

        return data


class BundleStatSerializer(serializers.Serializer):
    total_size = serializers.IntegerField(required=True)
    javascript_size = serializers.IntegerField(required=True)
    css_size = serializers.IntegerField(required=True)
    images_size = serializers.IntegerField(required=True)
    fonts_size = serializers.IntegerField(required=True)
    bundle_name = serializers.RegexField(r"^[\w\d_:/@\.{}\[\]$-]+$", required=True)
    environment = serializers.CharField(required=True)


class ListBundleStatsSerializer(serializers.Serializer):
    stats = BundleStatSerializer(many=True, required=True)
