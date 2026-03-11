from __future__ import annotations

import logging

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectDistributionPermission, ProjectEndpoint
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN
from sentry.apidocs.examples.preprod_examples import PreprodExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.project import Project
from sentry.preprod.api.models.public.installable_builds import (
    LatestInstallableBuildResponseDict,
    create_install_info_dict,
    create_latest_installable_build_response,
)
from sentry.preprod.api.validators import PreprodLatestInstallableBuildValidator
from sentry.preprod.build_distribution_utils import find_current_and_latest
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory

logger = logging.getLogger(__name__)


@extend_schema(tags=["Mobile Builds"])
@cell_silo_endpoint
class ProjectPreprodBuildDistributionLatestEndpoint(ProjectEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    permission_classes = (ProjectDistributionPermission,)
    rate_limits = RateLimitConfig(
        limit_overrides={
            "GET": {
                RateLimitCategory.ORGANIZATION: RateLimit(limit=100, window=60),
            }
        }
    )

    @extend_schema(
        operation_id="Get the latest installable build for a project",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            OpenApiParameter(
                name="appId",
                description="App identifier (exact match).",
                required=True,
                type=str,
                location="query",
            ),
            OpenApiParameter(
                name="platform",
                description='Platform: "apple" or "android".',
                required=True,
                type=str,
                location="query",
            ),
            OpenApiParameter(
                name="buildVersion",
                description="Current build version. When provided, enables check-for-updates mode.",
                required=False,
                type=str,
                location="query",
            ),
            OpenApiParameter(
                name="buildNumber",
                description="Current build number. Either this or mainBinaryIdentifier must be provided when buildVersion is set.",
                required=False,
                type=int,
                location="query",
            ),
            OpenApiParameter(
                name="mainBinaryIdentifier",
                description="UUID of the main binary (e.g. Mach-O UUID for Apple builds). Either this or buildNumber must be provided when buildVersion is set.",
                required=False,
                type=str,
                location="query",
            ),
            OpenApiParameter(
                name="buildConfiguration",
                description="Filter by build configuration name (exact match).",
                required=False,
                type=str,
                location="query",
            ),
            OpenApiParameter(
                name="codesigningType",
                description="Filter by code signing type.",
                required=False,
                type=str,
                location="query",
            ),
            OpenApiParameter(
                name="installGroups",
                description="Filter by install group name (repeatable for multiple groups).",
                required=False,
                type=str,
                location="query",
                many=True,
            ),
        ],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "LatestInstallableBuildResponse", LatestInstallableBuildResponseDict
            ),
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
        },
        examples=PreprodExamples.GET_LATEST_BUILD,
    )
    def get(
        self,
        request: Request,
        project: Project,
    ) -> Response:
        """
        Get the latest installable build for a project.

        Returns the latest installable build matching filter criteria.
        When buildVersion is provided, also returns the current build and
        whether an update is available.
        """

        validator = PreprodLatestInstallableBuildValidator(data=request.GET)
        validator.is_valid(raise_exception=True)
        params = validator.validated_data

        app_id: str = params["appId"]
        platform: str = params["platform"]
        build_version: str | None = params.get("buildVersion")
        build_number: int | None = params.get("buildNumber")
        main_binary_identifier: str | None = params.get("mainBinaryIdentifier")
        build_configuration: str | None = params.get("buildConfiguration")
        codesigning_type: str | None = params.get("codesigningType")
        install_groups: list[str] | None = [
            g for g in request.GET.getlist("installGroups") if g
        ] or None

        current_artifact, latest_artifact = find_current_and_latest(
            project=project,
            app_id=app_id,
            platform=platform,
            build_version=build_version,
            build_number=build_number,
            main_binary_identifier=main_binary_identifier,
            build_configuration=build_configuration,
            codesigning_type=codesigning_type,
            install_groups=install_groups,
        )

        if build_version and not current_artifact:
            logger.info(
                "preprod.latest_build.current_not_found",
                extra={
                    "project_id": project.id,
                    "app_id": app_id,
                    "platform": platform,
                    "build_version": build_version,
                },
            )

        latest_dict = None
        if latest_artifact:
            latest_dict = create_install_info_dict(latest_artifact)

        current_dict = None
        if current_artifact:
            current_dict = create_install_info_dict(current_artifact)

        return Response(
            create_latest_installable_build_response(
                latest=latest_dict,
                current=current_dict,
            )
        )
