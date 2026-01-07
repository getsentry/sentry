from __future__ import annotations

import logging

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.permissions import StaffPermission
from sentry.preprod.analytics import PreprodArtifactApiAdminGetInfoEvent
from sentry.preprod.models import (
    InstallablePreprodArtifact,
    PreprodArtifact,
    PreprodArtifactSizeMetrics,
)

logger = logging.getLogger(__name__)


@region_silo_endpoint
class PreprodArtifactAdminInfoEndpoint(Endpoint):
    owner = ApiOwner.EMERGE_TOOLS
    permission_classes = (StaffPermission,)
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, head_artifact_id: str) -> Response:
        """
        Get comprehensive info for a preprod artifact
        ````````````````````````````````````````````

        Admin endpoint to retrieve all associated data for a specific preprod artifact.
        This endpoint requires superuser privileges.

        Returns comprehensive information including:
        - Basic artifact metadata
        - Build and app information
        - VCS/commit information
        - File information
        - Size metrics
        - Error details (if any)

        :auth: required (superuser)
        #"""

        try:
            head_artifact_id_int = int(head_artifact_id)
        except ValueError:
            return Response(
                {"error": f"Invalid preprod artifact ID: {head_artifact_id}"}, status=400
            )

        try:
            preprod_artifact = PreprodArtifact.objects.select_related(
                "project",
                "project__organization",
                "commit_comparison",
                "build_configuration",
                "mobile_app_info",
            ).get(id=head_artifact_id_int)
        except PreprodArtifact.DoesNotExist:
            return Response(
                {"error": f"Preprod artifact {head_artifact_id_int} not found"}, status=404
            )

        analytics.record(
            PreprodArtifactApiAdminGetInfoEvent(
                organization_id=preprod_artifact.project.organization_id,
                project_id=preprod_artifact.project.id,
                user_id=request.user.id,
                artifact_id=head_artifact_id,
            )
        )

        size_metrics = list(
            PreprodArtifactSizeMetrics.objects.filter(preprod_artifact_id=head_artifact_id_int)
        )

        installable_artifacts = list(
            InstallablePreprodArtifact.objects.filter(preprod_artifact_id=head_artifact_id_int)
        )

        artifact_info = {
            "id": preprod_artifact.id,
            "state": preprod_artifact.state,
            "artifact_type": preprod_artifact.artifact_type,
            "date_added": (
                preprod_artifact.date_added.isoformat() if preprod_artifact.date_added else None
            ),
            "date_updated": (
                preprod_artifact.date_updated.isoformat() if preprod_artifact.date_updated else None
            ),
            "date_built": (
                preprod_artifact.date_built.isoformat() if preprod_artifact.date_built else None
            ),
            "project": {
                "id": preprod_artifact.project.id,
                "slug": preprod_artifact.project.slug,
                "name": preprod_artifact.project.name,
                "organization_id": preprod_artifact.project.organization_id,
                "organization_slug": preprod_artifact.project.organization.slug,
            },
            # App information
            "app_info": {
                "app_id": preprod_artifact.app_id,
                "app_name": (
                    preprod_artifact.mobile_app_info.app_name
                    if hasattr(preprod_artifact, "mobile_app_info")
                    else None
                ),
                "build_version": (
                    preprod_artifact.mobile_app_info.build_version
                    if hasattr(preprod_artifact, "mobile_app_info")
                    else None
                ),
                "build_number": (
                    preprod_artifact.mobile_app_info.build_number
                    if hasattr(preprod_artifact, "mobile_app_info")
                    else None
                ),
                "main_binary_identifier": preprod_artifact.main_binary_identifier,
            },
            # File information
            "files": {
                "file_id": preprod_artifact.file_id,
                "installable_app_file_id": preprod_artifact.installable_app_file_id,
            },
            # Build configuration
            "build_configuration": (
                {
                    "id": (
                        preprod_artifact.build_configuration.id
                        if preprod_artifact.build_configuration
                        else None
                    ),
                    "name": (
                        preprod_artifact.build_configuration.name
                        if preprod_artifact.build_configuration
                        else None
                    ),
                }
                if preprod_artifact.build_configuration
                else None
            ),
            # VCS/Commit information
            "vcs_info": (
                {
                    "head_sha": (
                        preprod_artifact.commit_comparison.head_sha
                        if preprod_artifact.commit_comparison
                        else None
                    ),
                    "base_sha": (
                        preprod_artifact.commit_comparison.base_sha
                        if preprod_artifact.commit_comparison
                        else None
                    ),
                    "provider": (
                        preprod_artifact.commit_comparison.provider
                        if preprod_artifact.commit_comparison
                        else None
                    ),
                    "head_repo_name": (
                        preprod_artifact.commit_comparison.head_repo_name
                        if preprod_artifact.commit_comparison
                        else None
                    ),
                    "base_repo_name": (
                        preprod_artifact.commit_comparison.base_repo_name
                        if preprod_artifact.commit_comparison
                        else None
                    ),
                    "head_ref": (
                        preprod_artifact.commit_comparison.head_ref
                        if preprod_artifact.commit_comparison
                        else None
                    ),
                    "base_ref": (
                        preprod_artifact.commit_comparison.base_ref
                        if preprod_artifact.commit_comparison
                        else None
                    ),
                    "pr_number": (
                        preprod_artifact.commit_comparison.pr_number
                        if preprod_artifact.commit_comparison
                        else None
                    ),
                }
                if preprod_artifact.commit_comparison
                else None
            ),
            # Error information
            "error_info": (
                {
                    "error_code": preprod_artifact.error_code,
                    "error_message": preprod_artifact.error_message,
                }
                if preprod_artifact.error_code or preprod_artifact.error_message
                else None
            ),
            # Size metrics
            "size_metrics": [
                {
                    "id": metric.id,
                    "metrics_artifact_type": metric.metrics_artifact_type,
                    "state": metric.state,
                    "error_code": metric.error_code,
                    "error_message": metric.error_message,
                    "processing_version": metric.processing_version,
                    "min_install_size": metric.min_install_size,
                    "max_install_size": metric.max_install_size,
                    "min_download_size": metric.min_download_size,
                    "max_download_size": metric.max_download_size,
                    "analysis_file_id": metric.analysis_file_id,
                    "date_added": metric.date_added.isoformat() if metric.date_added else None,
                    "date_updated": (
                        metric.date_updated.isoformat() if metric.date_updated else None
                    ),
                }
                for metric in size_metrics
            ],
            # Installable artifacts (download links)
            "installable_artifacts": [
                {
                    "id": installable.id,
                    "url_path": installable.url_path,
                    "expiration_date": (
                        installable.expiration_date.isoformat()
                        if installable.expiration_date
                        else None
                    ),
                    "download_count": installable.download_count,
                    "date_added": (
                        installable.date_added.isoformat() if installable.date_added else None
                    ),
                    "date_updated": (
                        installable.date_updated.isoformat() if installable.date_updated else None
                    ),
                }
                for installable in installable_artifacts
            ],
            # Extra data
            "extras": preprod_artifact.extras,
        }

        logger.info(
            "preprod_artifact.admin_get_info",
            extra={
                "artifact_id": head_artifact_id,
                "user_id": request.user.id,
                "organization_id": preprod_artifact.project.organization_id,
                "project_id": preprod_artifact.project.id,
            },
        )

        return Response(
            {
                "success": True,
                "artifact_info": artifact_info,
            }
        )
