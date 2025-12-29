from __future__ import annotations

import logging
from typing import Any

from django.db.models import Q
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import NoProjects, OrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.utils import get_date_range_from_params
from sentry.exceptions import InvalidParams
from sentry.models.organization import Organization
from sentry.preprod.analytics import PreprodArtifactApiListBuildsEvent
from sentry.preprod.api.models.project_preprod_build_details_models import (
    transform_preprod_artifact_to_build_details,
)
from sentry.preprod.api.validators import PreprodListBuildsValidator
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.utils import parse_release_version

logger = logging.getLogger(__name__)


@region_silo_endpoint
class OrganizationPreprodListBuildsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(self, request: Request, organization: Organization) -> Response:
        """
        List preprod builds for an organization across multiple projects
        ```````````````````````````````````````````````````````````````````

        List preprod builds for an organization with optional filtering by projects and pagination.

        :pparam string organization_id_or_slug: (required) the id or slug of the organization the
                                          artifacts belong to.
        :qparam list project: (optional) list of project IDs to filter by (query params like ?project=1&project=2)
        :qparam string app_id: (optional) filter by app identifier (e.g., "com.myapp.MyApp")
        :qparam string state: (optional) filter by artifact state (0=uploading, 1=uploaded, 3=processed, 4=failed)
        :qparam string build_version: (optional) filter by build version
        :qparam string build_configuration: (optional) filter by build configuration name
        :qparam string platform: (optional) filter by platform (ios, android, macos)
        :qparam string release_version: (optional) filter by release version (formats: "app_id@version+build_number" or "app_id@version")
        :qparam string query: (optional) general search across app name, app ID, build version, and commit SHA
        :qparam int per_page: (optional) number of results per page (default 25, max 100)
        :qparam string cursor: (optional) cursor for pagination
        :auth: required
        """

        if not features.has(
            "organizations:preprod-frontend-routes", organization, actor=request.user
        ):
            return Response({"error": "Feature not enabled"}, status=403)

        projects = self.get_projects(request, organization)
        if not projects:
            raise NoProjects("No projects available")

        project_ids = [p.id for p in projects]

        analytics.record(
            PreprodArtifactApiListBuildsEvent(
                organization_id=organization.id,
                user_id=request.user.id,
            )
        )

        validator = PreprodListBuildsValidator(data=request.GET)
        validator.is_valid(raise_exception=True)
        params = validator.validated_data

        try:
            start, end = get_date_range_from_params(request.GET, optional=True)
        except InvalidParams:
            raise ParseError(detail="Invalid date range")

        queryset = (
            PreprodArtifact.objects.select_related("project")
            .filter(project_id__in=project_ids)
            .order_by("-date_added")
        )

        if start and end:
            queryset = queryset.filter(date_added__gte=start, date_added__lte=end)

        release_version_parsed = False
        release_version = params.get("release_version")
        if release_version:
            parsed_version = parse_release_version(release_version)
            if parsed_version:
                queryset = queryset.filter(
                    app_id__icontains=parsed_version.app_id,
                    build_version__icontains=parsed_version.build_version,
                )
                release_version_parsed = True

        if not release_version_parsed:
            app_id = params.get("app_id")
            if app_id:
                queryset = queryset.filter(app_id__exact=app_id)

            build_version = params.get("build_version")
            if build_version:
                queryset = queryset.filter(build_version__icontains=build_version)

        query = params.get("query")
        if query and query.strip():
            search_term = query.strip()

            search_query = (
                Q(app_name__icontains=search_term)
                | Q(app_id__icontains=search_term)
                | Q(build_version__icontains=search_term)
                | Q(
                    commit_comparison__head_sha__icontains=search_term,
                    commit_comparison__organization_id=organization.id,
                )
                | Q(
                    commit_comparison__head_ref__icontains=search_term,
                    commit_comparison__organization_id=organization.id,
                )
            )

            if search_term.isdigit():
                search_query |= Q(
                    commit_comparison__pr_number=int(search_term),
                    commit_comparison__organization_id=organization.id,
                )
            queryset = queryset.filter(search_query)

        state = params.get("state")
        if state is not None:
            queryset = queryset.filter(state=state)

        build_configuration = params.get("build_configuration")
        if build_configuration:
            queryset = queryset.filter(build_configuration__name__exact=build_configuration)

        platform = params.get("platform")
        if platform:
            if platform.lower() == "ios" or platform.lower() == "macos":
                queryset = queryset.filter(artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE)
            elif platform.lower() == "android":
                queryset = queryset.filter(
                    artifact_type__in=[
                        PreprodArtifact.ArtifactType.AAB,
                        PreprodArtifact.ArtifactType.APK,
                    ]
                )
            else:
                raise ParseError(
                    detail=f"Unsupported platform: {platform}. Supported platforms are: ios, android, macos"
                )

        def transform_results(results: list[PreprodArtifact]) -> dict[str, Any]:
            build_details_list = []
            for artifact in results:
                try:
                    build_details = transform_preprod_artifact_to_build_details(artifact)
                    build_details_list.append(build_details.dict())
                except Exception as e:
                    logger.warning("Failed to transform artifact %s: %s", artifact.id, str(e))
                    continue
            return {"builds": build_details_list}

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-date_added",
            on_results=transform_results,
            paginator_cls=OffsetPaginator,
            default_per_page=params.get("per_page", 25),
            max_per_page=100,
        )
