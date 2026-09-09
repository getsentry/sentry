from typing import TypedDict

from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.permissions import StaffPermission
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.response_types import ValidationErrorResponse
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.workflow_engine.defaults.detectors import (
    ensure_default_detectors,
    ensure_default_organization_detectors,
)
from sentry.workflow_engine.endpoints.serializers.detector_serializer import (
    DetectorSerializerResponse,
)
from sentry.workflow_engine.models import Detector


class InboundHealthCheckSerializer(serializers.Serializer):
    projects = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        help_text="Project slugs to perform additional health checks for.",
    )


class DetectorHealthCheckResponse(TypedDict):
    """
    Result of a detector health check on an organization and potentially projects.
    """

    organization: dict[str, DetectorSerializerResponse]
    projects: dict[str, dict[str, DetectorSerializerResponse]] | None


@cell_silo_endpoint
class OrganizationDetectorHealthCheckEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ISSUES

    permission_classes = (StaffPermission,)

    @extend_schema(
        operation_id="Perform a Detector Health Check",
        parameters=[],
        responses={
            201: inline_sentry_response_serializer(
                "DetectorDetectorHealthCheckResponse", DetectorHealthCheckResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def post(
        self, request: Request, organization: Organization
    ) -> Response[ValidationErrorResponse] | Response[DetectorHealthCheckResponse]:
        serializer = InboundHealthCheckSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        organization_detectors_map = ensure_default_organization_detectors(organization)

        organization_detectors: dict[str, DetectorSerializerResponse] = {}
        for slug, detector in organization_detectors_map.items():
            organization_detectors[slug] = serialize(detector, request.user)

        project_slugs = serializer.validated_data.get("projects", [])
        if project_slugs:
            projects = self.get_projects(request, organization, project_slugs=set(project_slugs))
        else:
            projects = []

        project_detectors_map: dict[str, dict[str, Detector]] = {}
        for project in projects:
            project_detectors_map[project.slug] = ensure_default_detectors(project=project)

        requested_project_detectors: dict[str, dict[str, DetectorSerializerResponse]] = {}
        for project_slug, detectors in project_detectors_map.items():
            project_detectors: dict[str, DetectorSerializerResponse] = {}
            for slug, detector in detectors.items():
                project_detectors[slug] = serialize(detector, request.user)
            requested_project_detectors[project_slug] = project_detectors

        result: DetectorHealthCheckResponse = {
            "organization": organization_detectors,
            "projects": requested_project_detectors if requested_project_detectors else None,
        }

        return Response(result, status=201)
