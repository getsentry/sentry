import copy
from datetime import timedelta
from itertools import chain

from django.db.models import Count, IntegerField, Q, Value
from django.db.models.functions import TruncDay
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.base import EnvironmentMixin
from sentry.api.bases.team import TeamEndpoint
from sentry.api.helpers.environments import get_environments
from sentry.api.utils import get_date_range_from_params
from sentry.models import Group, GroupHistory, GroupHistoryStatus, Project, Team
from sentry.models.grouphistory import (
    ACTIONED_STATUSES,
    status_to_string_lookup,
    string_to_status_lookup,
)


class TeamIssueBreakdownEndpoint(TeamEndpoint, EnvironmentMixin):  # type: ignore
    def get(self, request: Request, team: Team) -> Response:
        """
        Returns a dict of team projects, and a time-series dict of issue stat breakdowns for each.

        If a list of statuses is passed then we return the count of each status and the totals.
        Otherwise we the count of reviewed issues and the total count of issues.
        """
        if not features.has("organizations:team-insights", team.organization, actor=request.user):
            return Response({"detail": "You do not have the insights feature enabled"}, status=400)
        start, end = get_date_range_from_params(request.GET)
        end = end.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
        start = start.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
        environments = [e.id for e in get_environments(request, team.organization)]

        if "statuses" in request.GET:
            statuses = [
                string_to_status_lookup[status] for status in request.GET.getlist("statuses")
            ]
            new_format = True
        else:
            statuses = [GroupHistoryStatus.UNRESOLVED] + ACTIONED_STATUSES
            new_format = False

        new_issues = []

        base_day_format = {"total": 0}
        if new_format:
            for status in statuses:
                base_day_format[status_to_string_lookup[status]] = 0
        else:
            base_day_format["reviewed"] = 0

        if GroupHistoryStatus.NEW in statuses:
            group_environment_filter = (
                Q(groupenvironment__environment_id=environments[0]) if environments else Q()
            )
            statuses.remove(GroupHistoryStatus.NEW)
            new_issues = list(
                Group.objects.filter_to_team(team)
                .filter(group_environment_filter, first_seen__gte=start, first_seen__lte=end)
                .annotate(bucket=TruncDay("first_seen"))
                .order_by("bucket")
                .values("project", "bucket")
                .annotate(
                    count=Count("id"),
                    status=Value(GroupHistoryStatus.NEW, output_field=IntegerField()),
                )
            )

        group_history_enviornment_filter = (
            Q(group__groupenvironment__environment_id=environments[0]) if environments else Q()
        )
        bucketed_issues = (
            GroupHistory.objects.filter_to_team(team)
            .filter(
                group_history_enviornment_filter,
                status__in=statuses,
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
            date_series_dict[current_day.isoformat()] = copy.deepcopy(base_day_format)
            current_day += timedelta(days=1)

        project_list = Project.objects.get_for_team_ids(team_ids=[team.id])
        agg_project_counts = {
            project.id: copy.deepcopy(date_series_dict) for project in project_list
        }
        for r in chain(bucketed_issues, new_issues):
            bucket = agg_project_counts[r["project"]][r["bucket"].isoformat()]
            bucket["total"] += r["count"]
            if not new_format and r["status"] != GroupHistoryStatus.UNRESOLVED:
                bucket["reviewed"] += r["count"]
            if new_format:
                bucket[status_to_string_lookup[r["status"]]] += r["count"]

        return Response(agg_project_counts)
