from rest_framework.request import Request
from rest_framework.response import Response

from sentry import tsdb
from sentry.api.base import StatsMixin, pending_silo_endpoint
from sentry.api.bases.monitor import MonitorEndpoint
from sentry.models import CheckInStatus, MonitorCheckIn


@pending_silo_endpoint
class MonitorStatsEndpoint(MonitorEndpoint, StatsMixin):
    # TODO(dcramer): probably convert to tsdb
    def get(self, request: Request, project, monitor) -> Response:
        args = self._parse_args(request)

        stats = {}
        duration_stats = {}
        current = tsdb.normalize_to_epoch(args["start"], args["rollup"])
        end = tsdb.normalize_to_epoch(args["end"], args["rollup"])

        # initialize success/failure/duration stats in preparation for counting/aggregating
        while current <= end:
            stats[current] = {CheckInStatus.OK: 0, CheckInStatus.ERROR: 0}
            duration_stats[current] = {"sum": 0, "num_checkins": 0}
            current += args["rollup"]

        # retrieve the list of checkins in the time range and count success/failure/duration
        history = MonitorCheckIn.objects.filter(
            monitor=monitor,
            status__in=[CheckInStatus.OK, CheckInStatus.ERROR],
            date_added__gt=args["start"],
            date_added__lte=args["end"],
        ).values_list("date_added", "status", "duration")
        for datetime, status, duration in history.iterator():
            ts = tsdb.normalize_to_epoch(datetime, args["rollup"])
            stats[ts][status] += 1
            if duration:
                duration_stats[ts]["sum"] += duration
                duration_stats[ts]["num_checkins"] += 1

        # compute average duration and construct response object
        stats_duration_data = []
        for ts, data in stats.items():
            duration_sum, num_checkins = duration_stats[ts].values()
            avg_duration = 0
            if num_checkins > 0:
                avg_duration = duration_sum / num_checkins
            stats_duration_data.append(
                {
                    "ts": ts,
                    "ok": data[CheckInStatus.OK],
                    "error": data[CheckInStatus.ERROR],
                    "duration": avg_duration,
                }
            )

        return Response(stats_duration_data)
