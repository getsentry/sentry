from __future__ import annotations

from collections import defaultdict
from datetime import timedelta
from typing import TypedDict

from django.db.models import Avg, F, Q
from django.db.models.functions import Coalesce, TruncDay
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import EnvironmentMixin, region_silo_endpoint
from sentry.api.bases.team import TeamEndpoint
from sentry.api.helpers.environments import get_environments
from sentry.api.utils import get_date_range_from_params
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus
from sentry.utils.dates import floor_to_utc_day


class _SumCount(TypedDict):
    sum: timedelta
    count: int


@region_silo_endpoint
class TeamTimeToResolutionEndpoint(TeamEndpoint, EnvironmentMixin):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, team) -> Response:
        """
        Return a a time bucketed list of mean group resolution times for a given team.
        """
        if not features.has("organizations:team-insights", team.organization, actor=request.user):
            return Response({"detail": "You do not have the insights feature enabled"}, status=400)

        start, end = get_date_range_from_params(request.GET)
        end = floor_to_utc_day(end) + timedelta(days=1)
        start = floor_to_utc_day(start) + timedelta(days=1)
        environments = [e.id for e in get_environments(request, team.organization)]
        grouphistory_environment_filter = (
            Q(group__groupenvironment__environment_id=environments[0]) if environments else Q()
        )

        history_list = (
            GroupHistory.objects.filter_to_team(team)
            .filter(
                grouphistory_environment_filter,
                status=GroupHistoryStatus.RESOLVED,
                date_added__gte=start,
                date_added__lte=end,
            )
            .annotate(bucket=TruncDay("date_added"))
            .values("bucket", "prev_history_date")
            # We need to coalesce here since we won't store the initial `UNRESOLVED` row for every
            # group, since it's unnecessary and just takes extra storage.
            .annotate(
                ttr=F("date_added") - Coalesce(F("prev_history_date"), F("group__first_seen"))
            )
            .annotate(avg_ttr=Avg("ttr"))
        )
        sums: dict[str, _SumCount]
        sums = defaultdict(lambda: {"sum": timedelta(), "count": 0})
        for gh in history_list:
            key = str(gh["bucket"].date())
            sums[key]["sum"] += gh["ttr"]
            sums[key]["count"] += 1

        avgs = {}
        current_day = start.date()
        end_date = end.date()
        while current_day < end_date:
            key = str(current_day)
            if key in sums:
                avg = int((sums[key]["sum"] / sums[key]["count"]).total_seconds())
                count = sums[key]["count"]
            else:
                avg = count = 0

            avgs[key] = {"avg": avg, "count": count}
            current_day += timedelta(days=1)

        return Response(avgs)
