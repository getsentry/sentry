from datetime import datetime
from typing import Any, TypedDict

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import release_health
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectEventsError, ProjectReleasePermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams, ReleaseParams
from sentry.apidocs.response_types import DetailResponse
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.release import Release
from sentry.release_health.base import is_overview_stat
from sentry.releases.auto_creation import should_auto_create_releases
from sentry.utils import metrics
from sentry.utils.dates import get_rollup_from_request


class ReleaseStatsUserBreakdown(TypedDict):
    date: datetime
    totalUsers: int
    crashFreeUsers: float | None
    totalSessions: int
    crashFreeSessions: float | None


class ProjectReleaseStatsResponse(TypedDict):
    # Time series of (timestamp, counts) entries; counts vary by `type`.
    stats: list[tuple[int, dict[str, Any]]]
    # Aggregate counts across the whole range.
    statTotals: dict[str, Any]
    usersBreakdown: list[ReleaseStatsUserBreakdown]


def upsert_missing_release(project, version) -> datetime | None:
    """This adds a release to postgres if it should exist but does not do yet."""
    try:
        return Release.objects.values_list("date_added", flat=True).get(
            organization=project.organization,
            projects=project,
            version=version,
        )
    except Release.DoesNotExist:
        rows = release_health.backend.get_oldest_health_data_for_releases([(project.id, version)])
        if not rows:
            return None
        oldest = next(iter(rows.values()))
        release = Release.get_or_create(
            project=project,
            version=version,
            date_added=oldest,
            create=should_auto_create_releases(project),
        )
        if release is None:
            metrics.incr("project_release_stats.release_autocreation_skipped")
            return None
        release.add_project(project)
        return release.date_added


@extend_schema(tags=["Releases"])
@cell_silo_endpoint
class ProjectReleaseStatsEndpoint(ProjectEndpoint):
    owner = ApiOwner.COMMUNITY
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (ProjectReleasePermission,)

    @extend_schema(
        operation_id="Retrieve a Project Release's Health Stats",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            ReleaseParams.VERSION,
            OpenApiParameter(
                name="type",
                location="query",
                required=False,
                type=str,
                enum=["sessions", "users"],
                description="The kind of health stat to return. Defaults to `sessions`.",
            ),
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ProjectReleaseStats", ProjectReleaseStatsResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self, request: Request, project, version
    ) -> Response[ProjectReleaseStatsResponse] | Response[DetailResponse]:
        """
        Return crash-free session/user health stats and a per-day breakdown for a release
        within a project.
        """
        stats_type = request.GET.get("type") or "sessions"
        if not is_overview_stat(stats_type):
            return Response({"detail": "invalid stat"}, status=400)

        try:
            params = self.get_filter_params(request, project)
            rollup = get_rollup_from_request(
                request,
                params["end"] - params["start"],
                default_interval="24h",
                error=ProjectEventsError(
                    "Your interval and date range would create too many results. "
                    "Use a larger interval, or a smaller date range."
                ),
            )
            # The minimum interval is one hour on the server
            rollup = max(rollup, 3600)
        except ProjectEventsError as e:
            return Response({"detail": str(e)}, status=400)

        release_date_added = upsert_missing_release(project, version)
        if release_date_added is None:
            raise ResourceDoesNotExist

        stats, totals = release_health.backend.get_project_release_stats(
            project_id=params["project_id"][0],
            release=version,
            stat=stats_type,
            rollup=rollup,
            start=params["start"],
            end=params["end"],
            environments=params.get("environment"),
        )

        users_breakdown = []
        for data in release_health.backend.get_crash_free_breakdown(
            project_id=params["project_id"][0],
            release=version,
            environments=params.get("environment"),
            start=release_date_added,
        ):
            users_breakdown.append(
                {
                    "date": data["date"],
                    "totalUsers": data["total_users"],
                    "crashFreeUsers": data["crash_free_users"],
                    "totalSessions": data["total_sessions"],
                    "crashFreeSessions": data["crash_free_sessions"],
                }
            )

        body: ProjectReleaseStatsResponse = serialize(
            {"stats": stats, "statTotals": totals, "usersBreakdown": users_breakdown}
        )
        return Response(body, status=200)
