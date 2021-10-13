from datetime import timedelta

from django.db.models import Count
from django.db.models.functions import TruncDay
from django.utils.timezone import now
from rest_framework.response import Response

from sentry.api.base import EnvironmentMixin
from sentry.api.bases.team import TeamEndpoint
from sentry.api.utils import get_date_range_from_params
from sentry.models import Project, Release, ReleaseProject


class TeamReleaseCountEndpoint(TeamEndpoint, EnvironmentMixin):
    def get(self, request, team):
        """
        Returns a dict of team projects, and a time-series list of release counts for each.
        """
        project_list = Project.objects.get_for_team_ids(team_ids=[team.id])
        start, end = get_date_range_from_params(request.GET)
        end = end.date() + timedelta(days=1)
        start = start.date() + timedelta(days=1)

        per_project_average_releases = (
            Release.objects.filter(
                id__in=ReleaseProject.objects.filter(project__in=project_list).values("release_id"),
                date_added__gte=now() - timedelta(days=84),
                date_added__lte=now(),
            )
            .values("projects")
            .annotate(count=Count("id"))
        )
        # TODO: Also need "this week" count for each project. Should i just bucket by week and average in python?
        project_avgs = {}
        for row in per_project_average_releases:
            project_avgs[row["projects"]] = row["count"] / 12

        bucketed_total_releases = (
            Release.objects.filter(
                id__in=ReleaseProject.objects.filter(project__in=project_list).values("release_id"),
                date_added__gte=start,
                date_added__lte=end,
            )
            .annotate(bucket=TruncDay("date_added"))
            .order_by("bucket")
            .values("bucket")
            .annotate(count=Count("id"))
        )

        current_day, agg_project_counts = start, {}
        while current_day < end:
            agg_project_counts[str(current_day)] = 0
            current_day += timedelta(days=1)

        for bucket in bucketed_total_releases:
            agg_project_counts[str(bucket["bucket"].date())] = bucket["count"]

        return Response({"release_counts": agg_project_counts, "project_avgs": project_avgs})
