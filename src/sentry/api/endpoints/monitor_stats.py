from collections import OrderedDict

from rest_framework.response import Response

from sentry import tsdb
from sentry.api.base import StatsMixin
from sentry.api.bases.monitor import MonitorEndpoint
from sentry.models import CheckInStatus, MonitorCheckIn


class MonitorStatsEndpoint(MonitorEndpoint, StatsMixin):
    # TODO(dcramer): probably convert to tsdb
    def get(self, request, project, monitor):
        args = self._parse_args(request)

        stats = OrderedDict()
        current = tsdb.normalize_to_epoch(args["start"], args["rollup"])
        end = tsdb.normalize_to_epoch(args["end"], args["rollup"])
        while current <= end:
            stats[current] = {CheckInStatus.OK: 0, CheckInStatus.ERROR: 0}
            current += args["rollup"]

        history = MonitorCheckIn.objects.filter(
            monitor=monitor,
            status__in=[CheckInStatus.OK, CheckInStatus.ERROR],
            date_added__gt=args["start"],
            date_added__lte=args["end"],
        ).values_list("date_added", "status")
        for datetime, status in history.iterator():
            stats[tsdb.normalize_to_epoch(datetime, args["rollup"])][status] += 1

        return Response(
            [
                {"ts": ts, "ok": data[CheckInStatus.OK], "error": data[CheckInStatus.ERROR]}
                for ts, data in stats.items()
            ]
        )
