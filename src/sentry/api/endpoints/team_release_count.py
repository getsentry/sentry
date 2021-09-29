from collections import defaultdict
from datetime import timedelta

from django.db.models import Count
from django.db.models.functions import TruncDay
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

        bucketed_releases = (
            Release.objects.filter(
                id__in=ReleaseProject.objects.filter(project__in=project_list).values("release_id"),
                date_added__gte=start,
                date_added__lte=end,
            )
            .annotate(bucket=TruncDay("date_added"))
            .order_by("bucket")
            .values("projects", "bucket")
            .annotate(count=Count("id"))
        )

        agg_project_counts = defaultdict(dict)
        for bucket in bucketed_releases:
            agg_project_counts[bucket["projects"]][
                str(bucket["bucket"].replace(tzinfo=None))
            ] = bucket["count"]

        current_day = start.replace(
            hour=0, minute=0, second=0, microsecond=0, tzinfo=None
        ) + timedelta(days=1)
        end_day = end.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)
        while current_day <= end_day:
            key = str(current_day)
            for project_id in list(agg_project_counts.keys()):
                if key not in agg_project_counts[project_id]:
                    agg_project_counts[project_id][key] = 0
            current_day += timedelta(days=1)

        return Response(agg_project_counts)
