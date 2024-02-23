from __future__ import annotations

from enum import Enum

from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.response import Response

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
    }
    owner: ApiOwner = ApiOwner.PERFORMANCE
    permission_classes: tuple[type[BasePermission], ...] = (ProjectReleasePermission,)

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
