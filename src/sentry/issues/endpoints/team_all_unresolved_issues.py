import copy
import datetime
from collections import defaultdict
from datetime import timedelta
from itertools import chain
from typing import int, TypedDict

from django.db.models import Case, Count, F, Q, QuerySet, Value, When
from django.db.models.functions import TruncDay
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.team import TeamEndpoint
from sentry.api.helpers.environments import get_environments
from sentry.api.utils import get_date_range_from_params
from sentry.models.group import Group, GroupStatus
from sentry.models.grouphistory import (
    RESOLVED_STATUSES,
    UNRESOLVED_STATUSES,
    GroupHistory,
    GroupHistoryStatus,
)
from sentry.models.project import Project
from sentry.models.team import Team

OPEN_STATUSES = UNRESOLVED_STATUSES + (GroupHistoryStatus.UNIGNORED,)
CLOSED_STATUSES = RESOLVED_STATUSES + (GroupHistoryStatus.IGNORED,)


class _Deduped(TypedDict):
    project: int
    bucket: datetime.datetime
    open: int
    closed: int


def calculate_unresolved_counts(
    team: Team,
    project_list: QuerySet[Project],
    start: datetime.datetime,
    end: datetime.datetime,
    environment_id: int | None,
) -> dict[int, dict[str, dict[str, int]]]:
    # Get the current number of unresolved issues. We can use this value for the most recent bucket.
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

    # Grab the historical data bucketed by day
    new_issues = (
        Group.objects.filter_to_team(team)
        .filter(group_environment_filter, first_seen__gte=start, first_seen__lt=end)
        .annotate(bucket=TruncDay("first_seen"), state=Value("open"), group_id=F("id"))
        .order_by("bucket", "group_id")
        .values("project", "group_id", "bucket", "state")[:200_000]
    )

    # Pull extra data to do deduplication in Python. (Inefficient to do in SQL via subqueries
    # (see ISWF-549); cannot do via DISTINCT ON state because of Django limitations.)
    bucketed_issues = (
        GroupHistory.objects.filter_to_team(team)
        .filter(
            group_history_environment_filter,
            date_added__gte=start,
            date_added__lte=end,
            status__in=OPEN_STATUSES + CLOSED_STATUSES,
        )
        .annotate(
            bucket=TruncDay("date_added"),
            state=Case(
                When(status__in=OPEN_STATUSES, then=Value("open")),
                When(status__in=CLOSED_STATUSES, then=Value("closed")),
                default=Value("other"),
            ),
        )
        .order_by(
            "group_id",
            "bucket",
            "id",
        )
        .values("project", "group_id", "bucket", "state")[:200_000]
    )

    # sorted() is a stable sort, so this will sort by bucket, and within each bucket
    # new issues are first, followed by bucketed issues (still sorted by id)
    historical_issue_status_changes = sorted(
        chain(new_issues, bucketed_issues), key=lambda i: i["bucket"]
    )

    most_recent_group_state: defaultdict[str, str] = defaultdict(lambda: "other")
    # Project => Bucket => State => Count
    deduping_map: defaultdict[int, defaultdict[datetime.datetime, defaultdict[str, int]]] = (
        defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    )

    for r in historical_issue_status_changes:
        # Don't process the row if it doesn't set the group to open or closed.
        if r["state"] == "other":
            continue

        # Don't process the row if it doesn't change the state.
        if r["state"] == most_recent_group_state[r["group_id"]]:
            continue

        deduping_map[r["project"]][r["bucket"]][r["state"]] += 1
        most_recent_group_state[r["group_id"]] = r["state"]

    deduped_historical_issue_status_changes: list[_Deduped] = []
    for p in deduping_map.keys():
        bucket_counts = deduping_map[p]
        for b in bucket_counts.keys():
            deduped_historical_issue_status_changes.append(
                {
                    "project": p,
                    "bucket": b,
                    "open": bucket_counts[b]["open"],
                    "closed": bucket_counts[b]["closed"],
                }
            )

    current_day, date_series_dict = start, {}
    while current_day < end:
        date_series_dict[current_day.isoformat()] = {"open": 0, "closed": 0}
        current_day += timedelta(days=1)

    agg_project_precounts = {
        project.id: copy.deepcopy(date_series_dict) for project in project_list
    }
    for r in deduped_historical_issue_status_changes:
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


@region_silo_endpoint
class TeamAllUnresolvedIssuesEndpoint(TeamEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

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
