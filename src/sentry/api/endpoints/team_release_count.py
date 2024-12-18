from collections import defaultdict
from datetime import timedelta

from django.db.models import Count
from django.db.models.functions import TruncDay
from django.utils.timezone import now
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import EnvironmentMixin, region_silo_endpoint
from sentry.api.bases.team import TeamEndpoint
from sentry.api.utils import get_date_range_from_params
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.utils.dates import floor_to_utc_day


@region_silo_endpoint
class TeamReleaseCountEndpoint(TeamEndpoint, EnvironmentMixin):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, team) -> Response:
        """
        Returns a dict of team projects, and a time-series list of release counts for each.
        """
        if not features.has("organizations:team-insights", team.organization, actor=request.user):
            return Response({"detail": "You do not have the insights feature enabled"}, status=400)
        project_list = Project.objects.get_for_team_ids(team_ids=[team.id])
        start, end = get_date_range_from_params(request.GET)
        end = floor_to_utc_day(end) + timedelta(days=1)
        start = floor_to_utc_day(start) + timedelta(days=1)

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
        project_avgs: dict[int, float] = defaultdict(int)
        this_week_totals: dict[int, int] = defaultdict(int)
        this_week_start = now() - timedelta(days=7)
        for row in per_project_daily_release_counts:
            project_avgs[row["projects"]] += row["count"]
            agg_project_counts[str(row["bucket"].date())] = row["count"]
            if row["bucket"] >= this_week_start:
                this_week_totals[row["projects"]] += row["count"]

        for project_id in project_avgs:
            project_avgs[project_id] = (project_avgs[project_id] / (end - start).days) * 7

        current_day = start.date()
        end_date = end.date()
        while current_day < end_date:
            agg_project_counts.setdefault(str(current_day), 0)
            current_day += timedelta(days=1)

        return Response(
            {
                "release_counts": agg_project_counts,
                "project_avgs": project_avgs,
                "last_week_totals": this_week_totals,
            }
        )
