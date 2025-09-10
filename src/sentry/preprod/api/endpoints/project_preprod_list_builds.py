import logging
import re

from django.db.models import Q
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.preprod.analytics import PreprodArtifactApiListBuildsEvent
from sentry.preprod.api.models.project_preprod_build_details_models import (
    transform_preprod_artifact_to_build_details,
)
from sentry.preprod.api.models.project_preprod_list_builds_models import (
    ListBuildsApiResponse,
    PaginationInfo,
)
from sentry.preprod.models import PreprodArtifact
from sentry.utils.cursors import Cursor

logger = logging.getLogger(__name__)


@region_silo_endpoint
class ProjectPreprodListBuildsEndpoint(ProjectEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(self, request: Request, project) -> Response:
        """
        List preprod builds for a project
        ````````````````````````````````````````````````````

        List preprod builds for a project with optional filtering and pagination.

        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          artifacts belong to.
        :pparam string project_id_or_slug: the id or slug of the project to retrieve the
                                     artifacts from.
        :qparam string app_id: filter by app identifier (e.g., "com.myapp.MyApp")
        :qparam string state: filter by artifact state (0=uploading, 1=uploaded, 3=processed, 4=failed)
        :qparam string build_version: filter by build version
        :qparam string build_configuration: filter by build configuration name
        :qparam string platform: filter by platform (ios, android, macos)
        :qparam string release_version: filter by release version (formats: "app_id@version+build_number" or "app_id@version")
        :qparam string search: general search across app name, app ID, build version, and commit SHA
        :qparam int limit: number of results per page (default 25, max 100)
        :qparam int page: page number (default 1)
        :auth: required
        """

        analytics.record(
            PreprodArtifactApiListBuildsEvent(
                organization_id=project.organization_id,
                project_id=project.id,
                user_id=request.user.id,
            )
        )

        if not features.has(
            "organizations:preprod-frontend-routes", project.organization, actor=request.user
        ):
            return Response({"error": "Feature not enabled"}, status=403)

        queryset = PreprodArtifact.objects.filter(project=project)

        release_version_parsed = False
        release_version = request.GET.get("release_version")
        if release_version:
            # Expected formats:
            # 1. "app_id@version+build_number"
            # 2. "app_id@version"
            # Parse app_id and version, ignoring build_number if present
            version_match = re.match(r"^([^@]+)@([^+]+)(?:\+.*)?$", release_version)

            if version_match:
                app_id_from_version, build_version_from_version = version_match.groups()
                queryset = queryset.filter(
                    app_id__icontains=app_id_from_version,
                    build_version__icontains=build_version_from_version,
                )
                release_version_parsed = True

        if not release_version_parsed:
            app_id = request.GET.get("app_id")
            if app_id:
                queryset = queryset.filter(app_id__icontains=app_id)

            build_version = request.GET.get("build_version")
            if build_version:
                queryset = queryset.filter(build_version__icontains=build_version)

        # General search across app fields and commit info - query can most likely be optimized further
        search = request.GET.get("search")
        if search and search.strip():
            search_term = search.strip()

            # Limit search length to prevent abuse
            if len(search_term) > 100:
                return Response({"error": "Search term too long"}, status=400)

            search_query = (
                Q(app_name__icontains=search_term)
                | Q(app_id__icontains=search_term)
                | Q(build_version__icontains=search_term)
                | Q(
                    commit_comparison__head_sha__icontains=search_term,
                    commit_comparison__organization_id=project.organization_id,
                )
                | Q(
                    commit_comparison__head_ref__icontains=search_term,
                    commit_comparison__organization_id=project.organization_id,
                )
            )

            if search_term.isdigit():
                search_query |= Q(
                    commit_comparison__pr_number=int(search_term),
                    commit_comparison__organization_id=project.organization_id,
                )
            queryset = queryset.filter(search_query)

        state = request.GET.get("state")
        if state:
            try:
                state_int = int(state)
                if state_int in [0, 1, 3, 4]:  # Valid states
                    queryset = queryset.filter(state=state_int)
            except ValueError:
                pass

        build_configuration = request.GET.get("build_configuration")
        if build_configuration:
            queryset = queryset.filter(build_configuration__name__icontains=build_configuration)

        platform = request.GET.get("platform")
        if platform:
            # For now, macos artifacts are also XCARCHIVE type
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
                return Response(
                    {"error": "Invalid platform: " + platform},
                    status=400,
                )

        queryset = queryset.order_by("-date_added")

        try:
            per_page = min(int(request.GET.get("per_page", 25)), 100)
            page = max(int(request.GET.get("page", 1)), 1)
        except ValueError:
            return Response(
                {"error": "Invalid pagination parameters: 'per_page' and 'page' must be integers."},
                status=400,
            )

        # Create paginator
        paginator = OffsetPaginator(
            queryset,
            order_by="-date_added",
            max_limit=100,
        )

        # Create cursor for pagination
        # For OffsetPaginator: cursor.offset = page number, cursor.value = limit
        # Since we want page 1 to start at offset 0, we need to adjust
        indexed_page = page - 1
        cursor = Cursor(per_page, indexed_page, False)

        # Get paginated results
        result = paginator.get_result(
            limit=per_page,
            cursor=cursor,
            count_hits=True,
        )

        # Transform the results using shared utility
        build_details_list = []
        for artifact in result.results:
            try:
                build_details_list.append(transform_preprod_artifact_to_build_details(artifact))
            except Exception as e:
                logger.warning("Failed to transform artifact %s: %s", artifact.id, str(e))
                continue

        # Build response with pagination info
        response_data = ListBuildsApiResponse(
            builds=build_details_list,
            pagination=PaginationInfo(
                next=result.next.offset if result.next.has_results else None,
                prev=result.prev.offset if result.prev.has_results else None,
                has_next=result.next.has_results,
                has_prev=result.prev.has_results,
                page=indexed_page,
                per_page=per_page,
                total_count=result.hits if result.hits is not None else "unknown",
            ),
        )

        return Response(response_data.dict())
