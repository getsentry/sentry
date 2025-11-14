from typing import int
from datetime import datetime

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import release_health
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectEventsError, ProjectReleasePermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models.release import Release
from sentry.release_health.base import is_overview_stat
from sentry.utils.dates import get_rollup_from_request


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
        if rows:
            oldest = next(iter(rows.values()))
            release = Release.get_or_create(project=project, version=version, date_added=oldest)
            release.add_project(project)
            return release.date_added
        else:
            return None


@region_silo_endpoint
class ProjectReleaseStatsEndpoint(ProjectEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }
    permission_classes = (ProjectReleasePermission,)

    def get(self, request: Request, project, version) -> Response:
        """
        Get a Project Release's Stats
        `````````````````````````````

        Returns the stats of a given release under a project.

        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          release belongs to.
        :pparam string project_id_or_slug: the id or slug of the project to list the
                                     release files of.
        :pparam string version: the version identifier of the release.
        :auth: required
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

        return Response(
            serialize({"stats": stats, "statTotals": totals, "usersBreakdown": users_breakdown}),
            status=200,
        )
