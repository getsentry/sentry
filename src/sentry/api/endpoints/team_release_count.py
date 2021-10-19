from collections import defaultdict
from datetime import timedelta

from django.db.models import Count
from django.db.models.functions import TruncDay
from django.utils.timezone import now
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
        end = end.date() + timedelta(days=1)
        start = start.date() + timedelta(days=1)

        per_project_daily_release_counts = (
            Release.objects.filter(
                projects__in=project_list,
                date_added__gte=start,
                date_added__lte=end,
            )
            .annotate(bucket=TruncDay("date_added"))
            .order_by("bucket")
            .values("projects", "bucket")
            .annotate(count=Count("id"))
        )

        agg_project_counts = {}
        project_avgs = defaultdict(int)
        this_week_totals = defaultdict(int)
        this_week_start = now() - timedelta(days=7)
        for row in per_project_daily_release_counts:
            project_avgs[row["projects"]] += row["count"]
            agg_project_counts[str(row["bucket"].date())] = row["count"]
            if row["bucket"] >= this_week_start:
                this_week_totals[row["projects"]] += row["count"]

        for row in project_avgs:
            project_avgs[row] = (project_avgs[row] / (end - start).days) * 7

        current_day = start
        while current_day < end:
            agg_project_counts.setdefault(str(current_day), 0)
            current_day += timedelta(days=1)

        return Response(
            {
                "release_counts": agg_project_counts,
                "project_avgs": project_avgs,
                "last_week_totals": this_week_totals,
            }
        )
