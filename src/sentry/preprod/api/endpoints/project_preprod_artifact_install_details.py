import logging
from typing import Any

from django.http import JsonResponse
from django.http.response import HttpResponseBase
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.preprod.api.models.project_preprod_build_details_models import (
    platform_from_artifact_type,
)
from sentry.preprod.build_distribution_utils import get_download_url_for_artifact
from sentry.preprod.models import PreprodArtifact

logger = logging.getLogger(__name__)


@region_silo_endpoint
class ProjectPreprodInstallDetailsEndpoint(ProjectEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(self, request: Request, project, artifact_id) -> HttpResponseBase:
        analytics.record(
            "preprod_artifact.api.install_details",
            organization_id=project.organization_id,
            project_id=project.id,
            user_id=request.user.id,
            artifact_id=artifact_id,
        )

        try:
            preprod_artifact = PreprodArtifact.objects.get(
                project=project,
                id=artifact_id,
            )
        except PreprodArtifact.DoesNotExist:
            return Response({"error": "Preprod artifact not found"}, status=404)

        # For iOS apps (XCARCHIVE), check code signature validity
        if preprod_artifact.artifact_type == PreprodArtifact.ArtifactType.XCARCHIVE:
            if (
                not preprod_artifact.extras
                or preprod_artifact.extras.get("is_code_signature_valid") is not True
            ):
                return JsonResponse(
                    {
                        "is_code_signature_valid": False,
                        "platform": platform_from_artifact_type(preprod_artifact.artifact_type),
                    }
                )

        if not preprod_artifact.installable_app_file_id:
            return Response({"error": "Installable file not available"}, status=404)

        installable_url = get_download_url_for_artifact(preprod_artifact)

        # Build response based on artifact type
        response_data: dict[str, Any] = {
            "install_url": installable_url,
            "platform": platform_from_artifact_type(preprod_artifact.artifact_type),
        }

        # Only include iOS-specific fields for iOS apps
        if preprod_artifact.artifact_type == PreprodArtifact.ArtifactType.XCARCHIVE:
            response_data.update(
                {
                    "is_code_signature_valid": True,
                    "profile_name": (
                        preprod_artifact.extras["profile_name"]
                        if preprod_artifact.extras and "profile_name" in preprod_artifact.extras
                        else "unknown"
                    ),
                    "codesigning_type": (
                        preprod_artifact.extras["codesigning_type"]
                        if preprod_artifact.extras and "codesigning_type" in preprod_artifact.extras
                        else "unknown"
                    ),
                }
            )

        response = JsonResponse(response_data)
        return response
