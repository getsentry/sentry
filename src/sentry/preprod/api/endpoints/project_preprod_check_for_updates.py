from __future__ import annotations

import logging

from pydantic import BaseModel
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectDistributionPermission, ProjectEndpoint
from sentry.models.project import Project
from sentry.preprod.build_distribution_utils import (
    find_current_artifact,
    find_latest_installable_artifact,
    get_download_url_for_artifact,
)
from sentry.preprod.models import PreprodBuildConfiguration
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory

logger = logging.getLogger(__name__)

# Map legacy platform names to the canonical names used by shared utilities
_PLATFORM_MAP = {"ios": "apple", "android": "android"}


class InstallableBuildDetails(BaseModel):
    id: str
    build_version: str
    build_number: int
    release_notes: str | None
    install_groups: list[str] | None
    download_url: str
    app_name: str
    created_date: str


class CheckForUpdatesApiResponse(BaseModel):
    update: InstallableBuildDetails | None = None
    current: InstallableBuildDetails | None = None


def _build_details_from_artifact(artifact):
    """Convert a PreprodArtifact to InstallableBuildDetails, or None."""
    mobile_app_info = getattr(artifact, "mobile_app_info", None)
    if not mobile_app_info or not mobile_app_info.build_version or not mobile_app_info.build_number:
        return None
    return InstallableBuildDetails(
        id=str(artifact.id),
        build_version=mobile_app_info.build_version,
        build_number=mobile_app_info.build_number,
        release_notes=(artifact.extras.get("release_notes") if artifact.extras else None),
        install_groups=(artifact.extras.get("install_groups") if artifact.extras else None),
        app_name=mobile_app_info.app_name,
        download_url=get_download_url_for_artifact(artifact),
        created_date=artifact.date_added.isoformat(),
    )


# Deprecated: This experimental endpoint is superseded by the public
# ProjectPreprodBuildDistributionLatestEndpoint at
# /api/0/{org}/{project}/preprodartifacts/build-distribution/latest/
@region_silo_endpoint
class ProjectPreprodArtifactCheckForUpdatesEndpoint(ProjectEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (ProjectDistributionPermission,)

    rate_limits = RateLimitConfig(
        limit_overrides={
            "GET": {
                RateLimitCategory.ORGANIZATION: RateLimit(limit=100, window=60),
            }
        }
    )

    def get(self, request: Request, project: Project) -> Response:
        """
        Check for updates for a preprod artifact
        """

        provided_main_binary_identifier = request.GET.get("main_binary_identifier")
        provided_app_id = request.GET.get("app_id")
        provided_platform = request.GET.get("platform")
        provided_build_version = request.GET.get("build_version")
        provided_build_number_str = request.GET.get("build_number")
        provided_build_configuration = request.GET.get("build_configuration")
        provided_codesigning_type = request.GET.get("codesigning_type")
        provided_install_groups = request.GET.getlist("install_groups")

        if not provided_app_id or not provided_platform or not provided_build_version:
            return Response({"error": "Missing required parameters"}, status=400)

        if not provided_main_binary_identifier and not provided_build_number_str:
            return Response(
                {"error": "Either main_binary_identifier or build_number must be provided"},
                status=400,
            )

        # Validate build_number
        provided_build_number: int | None = None
        if provided_build_number_str is not None:
            try:
                provided_build_number = int(provided_build_number_str)
            except ValueError:
                return Response({"error": "Invalid build_number format"}, status=400)

        # Validate build_configuration exists
        if provided_build_configuration:
            try:
                PreprodBuildConfiguration.objects.get(
                    project=project,
                    name=provided_build_configuration,
                )
            except PreprodBuildConfiguration.DoesNotExist:
                return Response({"error": "Invalid build configuration"}, status=400)

        platform = _PLATFORM_MAP.get(provided_platform, provided_platform)

        # Find current artifact
        current_artifact = find_current_artifact(
            project=project,
            app_id=provided_app_id,
            platform=platform,
            build_version=provided_build_version,
            build_number=provided_build_number,
            main_binary_identifier=provided_main_binary_identifier,
            build_configuration=provided_build_configuration,
            codesigning_type=provided_codesigning_type,
        )

        if not current_artifact:
            logger.warning(
                "No artifact found for binary identifier with version %s",
                provided_build_version,
            )

        current = _build_details_from_artifact(current_artifact) if current_artifact else None

        # Determine effective filters for latest lookup (inherit from current artifact)
        effective_build_configuration = provided_build_configuration
        effective_codesigning_type = provided_codesigning_type
        effective_install_groups: list[str] | None = provided_install_groups or None

        if current_artifact:
            if not effective_build_configuration and current_artifact.build_configuration:
                effective_build_configuration = current_artifact.build_configuration.name

            if not effective_codesigning_type and current_artifact.extras:
                effective_codesigning_type = current_artifact.extras.get("codesigning_type")

            if not effective_install_groups and current_artifact.extras:
                current_groups = current_artifact.extras.get("install_groups")
                if current_groups and isinstance(current_groups, list):
                    effective_install_groups = current_groups

        # Find latest installable artifact
        latest_artifact = find_latest_installable_artifact(
            project=project,
            app_id=provided_app_id,
            platform=platform,
            build_configuration_name=effective_build_configuration,
            codesigning_type=effective_codesigning_type,
            install_groups=effective_install_groups,
        )

        update = None
        if latest_artifact and (not current_artifact or current_artifact.id != latest_artifact.id):
            update = _build_details_from_artifact(latest_artifact)

        return Response(CheckForUpdatesApiResponse(current=current, update=update).dict())
