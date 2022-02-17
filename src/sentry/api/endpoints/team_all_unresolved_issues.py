import copy
from datetime import timedelta
from itertools import chain

from django.db.models import Count, OuterRef, Q, Subquery
from django.db.models.functions import Coalesce, TruncDay
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.base import EnvironmentMixin
from sentry.api.bases.team import TeamEndpoint
from sentry.api.helpers.environments import get_environments
from sentry.api.utils import get_date_range_from_params
from sentry.models import Group, GroupHistory, GroupHistoryStatus, GroupStatus, Project, Team
from sentry.models.grouphistory import RESOLVED_STATUSES, UNRESOLVED_STATUSES

OPEN_STATUSES = UNRESOLVED_STATUSES + (GroupHistoryStatus.UNIGNORED,)
CLOSED_STATUSES = RESOLVED_STATUSES + (GroupHistoryStatus.IGNORED,)


def calculate_unresolved_counts(team, project_list, start, end, environment_id):
    # Get the current number of unresolved issues. We can use this value for the the most recent bucket.
    group_environment_filter = (
        Q(groupenvironment__environment_id=environment_id) if environment_id else Q()
    )
    project_current_unresolved = {
        r["project"]: r["total"]
        for r in (
            Group.objects.filter_to_team(team)
            .filter(group_environment_filter, status=GroupStatus.UNRESOLVED)
            .values("project")
            .annotate(total=Count("id"))
        )
    }

    group_history_environment_filter = (
        Q(group__groupenvironment__environment_id=environment_id) if environment_id else Q()
    )
    prev_status_sub_qs = Coalesce(
        Subquery(
            GroupHistory.objects.filter(
                group_id=OuterRef("group_id"),
                date_added__lt=OuterRef("date_added"),
                status__in=OPEN_STATUSES + CLOSED_STATUSES,
            )
            .order_by("-id")
            .values("status")[:1]
        ),
        -1,
    )
    dedupe_status_filter = Q(
        (~Q(prev_status__in=OPEN_STATUSES) & Q(status__in=OPEN_STATUSES))
        | (~Q(prev_status__in=CLOSED_STATUSES) & Q(status__in=CLOSED_STATUSES))
    )

    # Grab the historical data bucketed by day
    new_issues = (
        Group.objects.filter_to_team(team)
        .filter(group_environment_filter, first_seen__gte=start, first_seen__lt=end)
        .annotate(bucket=TruncDay("first_seen"))
        .order_by("bucket")
        .values("project", "bucket")
        .annotate(open=Count("id"))
    )

    bucketed_issues = (
        GroupHistory.objects.filter_to_team(team)
        .filter(group_history_environment_filter, date_added__gte=start, date_added__lte=end)
        .annotate(bucket=TruncDay("date_added"), prev_status=prev_status_sub_qs)
        .filter(dedupe_status_filter)
        .order_by("bucket")
        .values("project", "bucket")
        .annotate(
            open=Count("id", filter=Q(status__in=OPEN_STATUSES)),
            closed=Count("id", filter=Q(status__in=CLOSED_STATUSES)),
        )
    )

    current_day, date_series_dict = start, {}
    while current_day < end:
        date_series_dict[current_day.isoformat()] = {"open": 0, "closed": 0}
        current_day += timedelta(days=1)

    agg_project_precounts = {
        project.id: copy.deepcopy(date_series_dict) for project in project_list
    }
    for r in chain(bucketed_issues, new_issues):
        bucket = agg_project_precounts[r["project"]][r["bucket"].isoformat()]
        bucket["open"] += r.get("open", 0)
        bucket["closed"] += r.get("closed", 0)

    agg_project_counts = {}
    for project, precounts in agg_project_precounts.items():
        open = project_current_unresolved.get(project, 0)
        sorted_bucket_keys = sorted(precounts.keys(), reverse=True)
        project_counts = {}

        for bucket_key in sorted_bucket_keys:
            bucket = precounts[bucket_key]
            project_counts[bucket_key] = {"unresolved": open}
            open = max(open - bucket["open"] + bucket["closed"], 0)
        agg_project_counts[project] = project_counts

    return agg_project_counts


class TeamAllUnresolvedIssuesEndpoint(TeamEndpoint, EnvironmentMixin):  # type: ignore
    def get(self, request: Request, team: Team) -> Response:
        """
        Returns cumulative counts of unresolved groups per day within the stats period time range.
        Response:
        {
            <project_id>: {
                <isoformat_date>: {"unresolved": <unresolved_count>},
                ...
            }
            ...
        }
        """
        if not features.has("organizations:team-insights", team.organization, actor=request.user):
            return Response({"detail": "You do not have the insights feature enabled"}, status=400)

        # Team has no projects
        project_list = Project.objects.get_for_team_ids(team_ids=[team.id])
        if len(project_list) == 0:
            return Response({})

        start, end = get_date_range_from_params(request.GET)
        end = end.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
        start = start.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
        environments = [e.id for e in get_environments(request, team.organization)]
        environment_id = environments[0] if environments else None

        return Response(calculate_unresolved_counts(team, project_list, start, end, environment_id))
