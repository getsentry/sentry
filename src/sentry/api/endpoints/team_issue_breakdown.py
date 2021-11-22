import copy
from datetime import timedelta

from django.db.models import Count
from django.db.models.functions import TruncDay
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.base import EnvironmentMixin
from sentry.api.bases.team import TeamEndpoint
from sentry.api.utils import get_date_range_from_params
from sentry.models import GroupHistory, GroupHistoryStatus, Project, Team
from sentry.models.grouphistory import ACTIONED_STATUSES


class TeamIssueBreakdownEndpoint(TeamEndpoint, EnvironmentMixin):  # type: ignore
    def get(self, request: Request, team: Team) -> Response:
        """
        Returns a dict of team projects, and a time-series dict of issue stat breakdowns for each.

        Right now the stats we return are the count of reviewed issues and the total count of issues.
        """
        if not features.has("organizations:team-insights", team.organization, actor=request.user):
            return Response({"detail": "You do not have the insights feature enabled"}, status=400)
        start, end = get_date_range_from_params(request.GET)
        end = end.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
        start = start.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
        bucketed_issues = (
            GroupHistory.objects.filter_to_team(team)
            .filter(
                status__in=[GroupHistoryStatus.UNRESOLVED] + ACTIONED_STATUSES,
                date_added__gte=start,
                date_added__lte=end,
            )
            .annotate(bucket=TruncDay("date_added"))
            .order_by("bucket")
            .values("project", "bucket", "status")
            .annotate(count=Count("id"))
        )

        current_day, date_series_dict = start, {}
        while current_day < end:
            date_series_dict[current_day.isoformat()] = {"reviewed": 0, "total": 0}
            current_day += timedelta(days=1)

        project_list = Project.objects.get_for_team_ids(team_ids=[team.id])
        agg_project_counts = {
            project.id: copy.deepcopy(date_series_dict) for project in project_list
        }
        for r in bucketed_issues:
            bucket = agg_project_counts[r["project"]][r["bucket"].isoformat()]
            bucket["total"] += r["count"]
            if r["status"] != GroupHistoryStatus.UNRESOLVED:
                bucket["reviewed"] += r["count"]

        return Response(agg_project_counts)
