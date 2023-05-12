from __future__ import annotations

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import tsdb
from sentry.api.base import StatsMixin, region_silo_endpoint
from sentry.api.helpers.environments import get_environments
from sentry.monitors.models import CheckInStatus, MonitorCheckIn

from .base import MonitorEndpoint


@region_silo_endpoint
class OrganizationMonitorStatsEndpoint(MonitorEndpoint, StatsMixin):
    # TODO(dcramer): probably convert to tsdb
    def get(self, request: Request, organization, project, monitor) -> Response:
        args = self._parse_args(request)

        stats = {}
        duration_stats = {}
        current = tsdb.normalize_to_epoch(args["start"], args["rollup"])
        end = tsdb.normalize_to_epoch(args["end"], args["rollup"])

        tracked_statuses = [
            CheckInStatus.OK,
            CheckInStatus.ERROR,
            CheckInStatus.MISSED,
            CheckInStatus.TIMEOUT,
        ]

        # initialize success/failure/missed/duration stats in preparation for counting/aggregating
        while current <= end:
            stats[current] = {status: 0 for status in tracked_statuses}
            duration_stats[current] = {"sum": 0, "num_checkins": 0}
            current += args["rollup"]

        # retrieve the list of checkins in the time range and count success/failure/missed/duration
        history = MonitorCheckIn.objects.filter(
            monitor=monitor,
            status__in=tracked_statuses,
            date_added__gt=args["start"],
            date_added__lte=args["end"],
        )

        environments = get_environments(request, organization)

        if environments:
            history = history.filter(monitor_environment__environment__in=environments)

        for datetime, status, duration in history.values_list(
            "date_added", "status", "duration"
        ).iterator():
            ts = tsdb.normalize_to_epoch(datetime, args["rollup"])
            stats[ts][status] += 1
            if duration:
                duration_stats[ts]["sum"] += duration
                duration_stats[ts]["num_checkins"] += 1

        stats_duration_data = []
        statuses_to_name = dict(CheckInStatus.as_choices())
        # compute average duration and construct response object
        for ts, data in stats.items():
            duration_sum, num_checkins = duration_stats[ts].values()
            avg_duration = 0
            if num_checkins > 0:
                avg_duration = duration_sum / num_checkins
            datapoint = {statuses_to_name[status]: data[status] for status in tracked_statuses}
            datapoint["ts"] = ts
            datapoint["duration"] = avg_duration
            stats_duration_data.append(datapoint)

        return Response(stats_duration_data)
