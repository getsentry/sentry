from __future__ import absolute_import

import six

from datetime import timedelta
from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission, ProjectEventsError
from sentry.api.serializers import serialize
from sentry.utils.dates import parse_stats_period
from sentry.snuba.sessions import get_project_release_stats, get_crash_free_breakdown

# Maximum number of results we are willing to fetch.
# Clients should adapt the interval width based on their
# display width.
MAX_POINTS = 4500


class ProjectReleaseStatsEndpoint(ProjectEndpoint):
    doc_section = DocSection.RELEASES
    permission_classes = (ProjectReleasePermission,)

    def get(self, request, project, version):
        """
        Get a Project Release's Stats
        `````````````````````````````

        Returns the stats of a given release under a project.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string project_slug: the slug of the project to list the
                                     release files of.
        :pparam string version: the version identifier of the release.
        :auth: required
        """
        stats_type = request.GET.get("type") or "sessions"
        if stats_type not in ("users", "sessions"):
            return Response({"detail": "invalid stat"}, status=400)

        try:
            params = self.get_filter_params(request, project)
            rollup = self.get_rollup(request, params)
        except ProjectEventsError as e:
            return Response({"detail": six.text_type(e)}, status=400)

        stats = get_project_release_stats(
            project_id=params["project_id"][0],
            release=version,
            stat=stats_type,
            rollup=rollup,
            start=params["start"],
            end=params["end"],
            environments=params.get("environment"),
        )

        users_breakdown = {}
        for timespan, data in six.iteritems(
            get_crash_free_breakdown(
                project_id=params["project_id"][0],
                release=version,
                environments=params.get("environment"),
            )
        ):
            users_breakdown[timespan] = {
                "totalUsers": data["total_users"],
                "crashFreeUsers": data["crash_free_users"],
                "totalSessions": data["total_sessions"],
                "crashFreeSessions": data["crash_free_sessions"],
            }

        return Response(serialize({"stats": stats, "usersBreakdown": users_breakdown}), status=200)

    def get_rollup(self, request, params):
        interval = parse_stats_period(request.GET.get("interval", "24h"))
        if interval is None:
            interval = timedelta(hours=1)

        date_range = params["end"] - params["start"]
        if date_range.total_seconds() / interval.total_seconds() > MAX_POINTS:
            raise ProjectEventsError(
                "Your interval and date range would create too many results. "
                "Use a larger interval, or a smaller date range."
            )

        return int(interval.total_seconds())
