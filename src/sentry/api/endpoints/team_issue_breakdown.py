import copy
from datetime import timedelta

from django.db.models import Count
from django.db.models.functions import TruncDay
from rest_framework.response import Response

from sentry.api.base import EnvironmentMixin
from sentry.api.bases.team import TeamEndpoint
from sentry.api.utils import get_date_range_from_params
from sentry.models import GroupHistory, GroupHistoryStatus, Project
from sentry.models.grouphistory import ACTIONED_STATUSES


class TeamIssueBreakdownEndpoint(TeamEndpoint, EnvironmentMixin):
    def get(self, request, team):
        """
        Returns a dict of team projects, and a time-series dict of issue stat breakdowns for each.

        Right now the stats we return are the count of reviewed issues and the total count of issues.
        """
        project_list = Project.objects.get_for_team_ids(team_ids=[team.id])
        start, end = get_date_range_from_params(request.GET)
        end = end.date() + timedelta(days=1)
        start = start.date() + timedelta(days=1)
        bucketed_issues = (
            GroupHistory.objects.filter(
                organization_id=team.organization_id,
                status__in=[GroupHistoryStatus.UNRESOLVED] + ACTIONED_STATUSES,
                project__in=project_list,
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
            date_series_dict[str(current_day)] = {"reviewed": 0, "total": 0}
            current_day += timedelta(days=1)

        agg_project_counts = {
            project.id: copy.deepcopy(date_series_dict) for project in project_list
        }
        for r in bucketed_issues:
            date = str(r["bucket"].date())
            agg_project_counts[r["project"]][date]["total"] += r["count"]
            if r["status"] != GroupHistoryStatus.UNRESOLVED:
                agg_project_counts[r["project"]][date]["reviewed"] += r["count"]

        return Response(agg_project_counts)
