import logging
import secrets
from datetime import timedelta
from typing import Any

from django.http import JsonResponse
from django.http.response import HttpResponseBase
from django.utils import timezone
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
from sentry.preprod.models import InstallablePreprodArtifact, PreprodArtifact

logger = logging.getLogger(__name__)


def create_installable_preprod_artifact(
    preprod_artifact: PreprodArtifact, expiration_hours: int = 12
) -> InstallablePreprodArtifact:
    """
    Creates a new InstallablePreprodArtifact for a given PreprodArtifact.

    Args:
        preprod_artifact: The PreprodArtifact to create an installable version for
        expiration_hours: Number of hours until the install link expires (default: 12)

    Returns:
        The created InstallablePreprodArtifact instance
    """

    url_path = secrets.token_urlsafe(12)

    # Set expiration date
    expiration_date = timezone.now() + timedelta(hours=expiration_hours)

    # Create the installable artifact
    installable_artifact = InstallablePreprodArtifact.objects.create(
        preprod_artifact=preprod_artifact,
        url_path=url_path,
        expiration_date=expiration_date,
        download_count=0,
    )

    logger.info(
        "Created installable preprod artifact",
        extra={
            "installable_artifact_id": installable_artifact.id,
            "preprod_artifact_id": preprod_artifact.id,
            "project_id": preprod_artifact.project.id,
            "organization_id": preprod_artifact.project.organization.id,
            "expiration_date": expiration_date.isoformat(),
        },
    )

    return installable_artifact


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

        installable = create_installable_preprod_artifact(preprod_artifact)

        # Only add response_format=plist for iOS apps (XCARCHIVE type)
        url_params = ""
        if preprod_artifact.artifact_type == PreprodArtifact.ArtifactType.XCARCHIVE:
            url_params = "?response_format=plist"

        installable_url = request.build_absolute_uri(
            f"/api/0/projects/{project.organization.slug}/{project.slug}/files/installablepreprodartifact/{installable.url_path}/{url_params}"
        )

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
