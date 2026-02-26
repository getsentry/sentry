from __future__ import annotations

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.paginator import DateTimePaginator
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN
from sentry.apidocs.examples.preprod_examples import PreprodExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.project import Project
from sentry.preprod.api.models.public.installable_builds import (
    InstallableBuildResponseDict,
    create_installable_build_dict,
)
from sentry.preprod.api.validators import PreprodPublicBuildsValidator
from sentry.preprod.models import PreprodArtifact


@extend_schema(tags=["Mobile Builds"])
@region_silo_endpoint
class ProjectPreprodBuildDistributionLatestEndpoint(ProjectEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="List latest installable builds for a project",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            OpenApiParameter(
                name="platform",
                description='Filter by platform: "apple" or "android".',
                required=False,
                type=str,
                location="query",
            ),
            OpenApiParameter(
                name="appId",
                description="Filter by app identifier (exact match).",
                required=False,
                type=str,
                location="query",
            ),
            OpenApiParameter(
                name="branch",
                description="Filter by git branch (head ref).",
                required=False,
                type=str,
                location="query",
            ),
            OpenApiParameter(
                name="buildVersion",
                description="Filter by build version (contains match).",
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
                name="prNumber",
                description="Filter by pull request number.",
                required=False,
                type=int,
                location="query",
            ),
            OpenApiParameter(
                name="installGroup",
                description="Filter by install group name (exact match).",
                required=False,
                type=str,
                location="query",
            ),
            OpenApiParameter(
                name="perPage",
                description="Number of results per page (default 25, max 100).",
                required=False,
                type=int,
                location="query",
            ),
        ],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "BuildsListResponse", list[InstallableBuildResponseDict]
            ),
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
        },
        examples=PreprodExamples.GET_BUILDS,
    )
    def get(
        self,
        request: Request,
        project: Project,
    ) -> Response:
        """
        List latest installable builds for a project.

        Returns the latest installable builds matching filter criteria, paginated.
        Only processed builds with an installable app file are returned.
        """

        if not features.has(
            "organizations:preprod-frontend-routes",
            project.organization,
            actor=request.user,
        ):
            return Response({"detail": "Feature not enabled"}, status=403)

        validator = PreprodPublicBuildsValidator(data=request.GET)
        validator.is_valid(raise_exception=True)
        params = validator.validated_data

        queryset = PreprodArtifact.objects.select_related(
            "project", "build_configuration", "commit_comparison", "mobile_app_info"
        ).filter(
            project=project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            installable_app_file_id__isnull=False,
            mobile_app_info__build_number__isnull=False,
        )

        platform = params.get("platform")
        if platform:
            if platform == "apple":
                queryset = queryset.filter(artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE)
            elif platform == "android":
                queryset = queryset.filter(
                    artifact_type__in=[
                        PreprodArtifact.ArtifactType.AAB,
                        PreprodArtifact.ArtifactType.APK,
                    ]
                )

        app_id = params.get("appId")
        if app_id:
            queryset = queryset.filter(app_id__exact=app_id)

        branch = params.get("branch")
        if branch:
            queryset = queryset.filter(
                commit_comparison__head_ref=branch,
                commit_comparison__organization_id=project.organization_id,
            )

        build_version = params.get("buildVersion")
        if build_version:
            queryset = queryset.filter(mobile_app_info__build_version__icontains=build_version)

        build_configuration = params.get("buildConfiguration")
        if build_configuration:
            queryset = queryset.filter(build_configuration__name__exact=build_configuration)

        pr_number = params.get("prNumber")
        if pr_number is not None:
            queryset = queryset.filter(
                commit_comparison__pr_number=pr_number,
                commit_comparison__organization_id=project.organization_id,
            )

        install_group = params.get("installGroup")
        if install_group:
            queryset = queryset.filter(extras__install_groups__contains=[install_group])

        annotated_queryset = queryset.annotate_download_count().order_by(  # type: ignore[attr-defined]
            "-date_added"
        )

        def on_results(results: list[PreprodArtifact]) -> list[InstallableBuildResponseDict]:
            return [create_installable_build_dict(artifact) for artifact in results]

        return self.paginate(
            request=request,
            queryset=annotated_queryset,
            order_by="-date_added",
            on_results=on_results,
            paginator_cls=DateTimePaginator,
            default_per_page=params.get("perPage", 25),
            max_per_page=100,
        )
