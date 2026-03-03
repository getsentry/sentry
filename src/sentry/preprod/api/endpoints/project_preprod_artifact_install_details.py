from __future__ import annotations

import logging
from typing import Any

import sentry_sdk
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.models.project import Project
from sentry.preprod.analytics import PreprodArtifactApiInstallDetailsEvent
from sentry.preprod.api.bases.preprod_artifact_endpoint import PreprodArtifactEndpoint
from sentry.preprod.build_distribution_utils import (
    get_artifact_install_info,
    get_download_count_for_artifact,
    get_download_url_for_artifact,
)
from sentry.preprod.models import PreprodArtifact

logger = logging.getLogger(__name__)


@region_silo_endpoint
class ProjectPreprodInstallDetailsEndpoint(PreprodArtifactEndpoint):
    """Deprecated: Use OrganizationPreprodArtifactPublicInstallDetailsEndpoint instead."""

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
    ) -> Response:
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

        info = get_artifact_install_info(head_artifact)

        if head_artifact.artifact_type == PreprodArtifact.ArtifactType.XCARCHIVE:
            if not info.is_code_signature_valid:
                return Response(
                    {
                        "is_code_signature_valid": False,
                        "code_signature_errors": (
                            head_artifact.extras.get("code_signature_errors", [])
                            if head_artifact.extras
                            else []
                        ),
                        "platform": head_artifact.platform,
                    }
                )

        if not head_artifact.installable_app_file_id:
            return Response({"error": "Installable file not available"}, status=404)

        installable_url = get_download_url_for_artifact(head_artifact)
        total_download_count = get_download_count_for_artifact(head_artifact)

        response_data: dict[str, Any] = {
            "install_url": installable_url,
            "platform": head_artifact.platform,
            "download_count": total_download_count,
            "release_notes": info.release_notes,
            "install_groups": info.install_groups,
        }

        if head_artifact.artifact_type == PreprodArtifact.ArtifactType.XCARCHIVE:
            response_data.update(
                {
                    "is_code_signature_valid": True,
                    "profile_name": info.profile_name or "unknown",
                    "codesigning_type": info.codesigning_type or "unknown",
                }
            )

        return Response(response_data)
