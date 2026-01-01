from __future__ import annotations

import logging
from typing import Any

import sentry_sdk
from django.http import JsonResponse
from django.http.response import HttpResponseBase
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.models.project import Project
from sentry.preprod.analytics import PreprodArtifactApiInstallDetailsEvent
from sentry.preprod.api.bases.preprod_artifact_endpoint import PreprodArtifactEndpoint
from sentry.preprod.api.models.project_preprod_build_details_models import (
    platform_from_artifact_type,
)
from sentry.preprod.build_distribution_utils import (
    get_download_count_for_artifact,
    get_download_url_for_artifact,
)
from sentry.preprod.models import PreprodArtifact

logger = logging.getLogger(__name__)


@region_silo_endpoint
class ProjectPreprodInstallDetailsEndpoint(PreprodArtifactEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(
        self,
        request: Request,
        project: Project,
        head_artifact_id: int,
        head_artifact: PreprodArtifact,
    ) -> HttpResponseBase:
        try:
            analytics.record(
                PreprodArtifactApiInstallDetailsEvent(
                    organization_id=project.organization_id,
                    project_id=project.id,
                    user_id=request.user.id,
                    artifact_id=str(head_artifact_id),
                )
            )
        except Exception as e:
            sentry_sdk.capture_exception(e)

        # For iOS apps (XCARCHIVE), check code signature validity
        if head_artifact.artifact_type == PreprodArtifact.ArtifactType.XCARCHIVE:
            if (
                not head_artifact.extras
                or head_artifact.extras.get("is_code_signature_valid") is not True
            ):
                return JsonResponse(
                    {
                        "is_code_signature_valid": False,
                        "code_signature_errors": (
                            head_artifact.extras.get("code_signature_errors", [])
                            if head_artifact.extras
                            else []
                        ),
                        "platform": platform_from_artifact_type(head_artifact.artifact_type),
                    }
                )

        if not head_artifact.installable_app_file_id:
            return Response({"error": "Installable file not available"}, status=404)

        installable_url = get_download_url_for_artifact(head_artifact)

        total_download_count = get_download_count_for_artifact(head_artifact)

        # Build response based on artifact type
        response_data: dict[str, Any] = {
            "install_url": installable_url,
            "platform": platform_from_artifact_type(head_artifact.artifact_type),
            "download_count": total_download_count,
            "release_notes": (
                head_artifact.extras.get("release_notes") if head_artifact.extras else None
            ),
        }

        # Only include iOS-specific fields for iOS apps
        if head_artifact.artifact_type == PreprodArtifact.ArtifactType.XCARCHIVE:
            response_data.update(
                {
                    "is_code_signature_valid": True,
                    "profile_name": (
                        head_artifact.extras["profile_name"]
                        if head_artifact.extras and "profile_name" in head_artifact.extras
                        else "unknown"
                    ),
                    "codesigning_type": (
                        head_artifact.extras["codesigning_type"]
                        if head_artifact.extras and "codesigning_type" in head_artifact.extras
                        else "unknown"
                    ),
                }
            )

        response = JsonResponse(response_data)
        return response
