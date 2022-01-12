import copy
from datetime import timedelta
from itertools import chain

from django.db.models import (
    Count,
    Exists,
    ExpressionWrapper,
    F,
    IntegerField,
    Min,
    OuterRef,
    Q,
    Subquery,
)
from django.db.models.functions import Coalesce, TruncDay
from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.base import EnvironmentMixin
from sentry.api.bases.team import TeamEndpoint
from sentry.api.utils import get_date_range_from_params
from sentry.models import Group, GroupHistory, GroupHistoryStatus, GroupStatus, Project, Team
from sentry.models.grouphistory import RESOLVED_STATUSES, UNRESOLVED_STATUSES

OPEN_STATUSES = UNRESOLVED_STATUSES + (GroupHistoryStatus.UNIGNORED,)
CLOSED_STATUSES = RESOLVED_STATUSES + (GroupHistoryStatus.IGNORED,)


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

        # First we get the count of unresolved groups from before we were writing `GroupHistory`
        # records. This will be reasonably accurate but not perfect.
        oldest_history_date = GroupHistory.objects.filter_to_team(team).aggregate(
            Min("date_added"),
        )["date_added__min"]

        if oldest_history_date is None:
            oldest_history_date = timezone.now()

        project_unresolved = {
            r["project"]: r["unresolved"]
            for r in (
                Group.objects.filter_to_team(team)
                .filter(first_seen__lt=oldest_history_date)
                .values("project")
                .annotate(
                    total=Count("id"),
                    resolved=Count("id", filter=Q(resolved_at__lt=oldest_history_date)),
                )
                .annotate(
                    unresolved=ExpressionWrapper(
                        F("total") - F("resolved"), output_field=IntegerField()
                    )
                )
            )
        }

        project_ignored = {
            r["project"]: r["total"]
            for r in (
                Group.objects.filter_to_team(team)
                .annotate(
                    ignored_exists=Exists(
                        GroupHistory.objects.filter(
                            group_id=OuterRef("id"),
                            status__in=[GroupHistoryStatus.IGNORED, GroupHistoryStatus.UNIGNORED],
                        ),
                    ),
                )
                .filter(ignored_exists=False, status=GroupStatus.IGNORED)
                .values("project")
                .annotate(
                    total=Count("id"),
                )
            )
        }
        for project, ignored in project_ignored.items():
            if project not in project_unresolved:
                # This shouldn't be able to happen since the project should already be included,
                # but just being defensive.
                continue
            project_unresolved[project] = max(project_unresolved[project] - ignored, 0)

        # TODO: We could write a query to fetch any unignored GroupHistory rows that don't have
        # a corresponding ignored row. This would imply that the Group was ignored before we had
        # history of it happening, and we could use that to help determine initial ignored count.
        # Might not be as important as the general ignored detection above.

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

        # Next, if there's data in the group history table before the stats period then grab that
        # and use it to help calculate the initial unresolved value
        if oldest_history_date < start:
            new_for_projects = (
                Group.objects.filter_to_team(team)
                .filter(
                    first_seen__gte=oldest_history_date,
                    first_seen__lt=start,
                )
                .values("project")
                .annotate(open=Count("id"))
            )
            initial_project_history_counts = (
                GroupHistory.objects.filter_to_team(team)
                .filter(
                    date_added__gte=oldest_history_date,
                    date_added__lt=start,
                )
                .annotate(prev_status=prev_status_sub_qs)
                .filter(dedupe_status_filter)
                .values("project")
                .annotate(
                    reopened=Count("id", filter=Q(status__in=OPEN_STATUSES)),
                    closed=Count("id", filter=Q(status__in=CLOSED_STATUSES)),
                )
            )
            for row in new_for_projects:
                project_unresolved.setdefault(row["project"], 0)
                project_unresolved[row["project"]] += row["open"]
            for row in initial_project_history_counts:
                project_unresolved.setdefault(row["project"], 0)
                project_unresolved[row["project"]] += row["reopened"] - row["closed"]

        # Just a failsafe to make sure we haven't gone below 0
        for project in list(project_unresolved.keys()):
            project_unresolved[project] = max(0, project_unresolved[project])

        # Now we grab the rest of the data bucketed by day
        new_issues = (
            Group.objects.filter_to_team(team)
            .filter(
                first_seen__gte=start,
                first_seen__lt=end,
            )
            .annotate(bucket=TruncDay("first_seen"))
            .order_by("bucket")
            .values("project", "bucket")
            .annotate(open=Count("id"))
        )

        bucketed_issues = (
            GroupHistory.objects.filter_to_team(team)
            .filter(
                date_added__gte=start,
                date_added__lte=end,
            )
            .annotate(
                bucket=TruncDay("date_added"),
                prev_status=prev_status_sub_qs,
            )
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
            open = project_unresolved.get(project, 0)
            sorted_bucket_keys = sorted(precounts.keys())
            project_counts = {}
            for bucket_key in sorted_bucket_keys:
                bucket = precounts[bucket_key]
                open = max(open + bucket["open"] - bucket["closed"], 0)
                project_counts[bucket_key] = {"unresolved": open}
            agg_project_counts[project] = project_counts

        return Response(agg_project_counts)
