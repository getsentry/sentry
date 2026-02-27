from __future__ import annotations

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.apidocs.examples.preprod_examples import PreprodExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.preprod.api.models.public.installable_builds import (
    InstallInfoResponseDict,
    create_install_info_dict,
)
from sentry.preprod.models import PreprodArtifact


@extend_schema(tags=["Mobile Builds"])
@region_silo_endpoint
class OrganizationPreprodArtifactPublicInstallDetailsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="Retrieve install info for a given artifact",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OpenApiParameter(
                name="artifact_id",
                description="The ID of the build artifact.",
                required=True,
                type=str,
                location="path",
            ),
        ],
        request=None,
        responses={
            200: inline_sentry_response_serializer("InstallInfoResponse", InstallInfoResponseDict),
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=PreprodExamples.GET_INSTALL_INFO,
    )
    def get(
        self,
        request: Request,
        organization: Organization,
        artifact_id: str,
    ) -> Response:
        """
        Retrieve install info for a given artifact.

        Returns distribution and installation details for a specific preprod artifact,
        including whether the artifact is installable, the install URL, download count,
        and iOS-specific code signing information.
        """

        if not features.has(
            "organizations:preprod-frontend-routes", organization, actor=request.user
        ):
            return Response({"detail": "Feature not enabled"}, status=403)

        try:
            artifact = PreprodArtifact.objects.select_related(
                "mobile_app_info",
                "build_configuration",
                "commit_comparison",
                "project__organization",
            ).get(id=int(artifact_id), project__organization_id=organization.id)
        except (PreprodArtifact.DoesNotExist, ValueError):
            return Response({"detail": "The requested preprod artifact does not exist"}, status=404)

        response_data = create_install_info_dict(artifact)
        return Response(response_data)
