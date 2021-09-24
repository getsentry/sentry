from collections import defaultdict

from django.db.models import Count
from django.db.models.functions import TruncDay
from rest_framework.response import Response

from sentry.api.base import EnvironmentMixin
from sentry.api.bases.team import TeamEndpoint
from sentry.api.utils import get_date_range_from_params
from sentry.models import Project, Release


class TeamReleaseCountEndpoint(TeamEndpoint, EnvironmentMixin):
    def get(self, request, team):
        """
        Returns a dict of team projects, and a time-series list of release counts for each.
        """
        project_list = Project.objects.get_for_team_ids(team_ids=[team.id])
        start, end = get_date_range_from_params(request.GET)

        bucketed_releases = (
            Release.objects.filter(
                projects__in=project_list, date_added__gte=start, date_added__lte=end
            )
            .distinct()
            .annotate(bucket=TruncDay("date_added"))
            .values("projects", "bucket")
            .annotate(count=Count("id"))
        )

        agg_project_counts = defaultdict(list)
        for bucket in bucketed_releases:
            agg_project_counts[bucket["projects"]].append(
                {"bucket": bucket["bucket"], "count": bucket["count"]}
            )

        return Response(agg_project_counts)
