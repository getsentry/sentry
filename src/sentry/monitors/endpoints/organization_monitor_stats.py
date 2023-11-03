from __future__ import annotations

from collections import OrderedDict
from datetime import datetime, timedelta

from django.db.models import Avg, Count, DateTimeField, Func
from django.db.models.functions import Extract
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import StatsMixin, region_silo_endpoint
from sentry.api.helpers.environments import get_environments
from sentry.monitors.models import CheckInStatus, MonitorCheckIn
from sentry.utils.dates import to_timestamp

from .base import MonitorEndpoint


def normalize_to_epoch(timestamp: datetime, seconds: int):
    """
    Given a ``timestamp`` (datetime object) normalize to an epoch timestamp.

    i.e. if the rollup is minutes, the resulting timestamp would have
    the seconds and microseconds rounded down.
    """
    epoch = int(to_timestamp(timestamp))
    return epoch - (epoch % seconds)


@region_silo_endpoint
class OrganizationMonitorStatsEndpoint(MonitorEndpoint, StatsMixin):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.CRONS

    # TODO(dcramer): probably convert to tsdb
    def get(self, request: Request, organization, project, monitor) -> Response:
        args = self._parse_args(request)

        start = normalize_to_epoch(args["start"], args["rollup"])
        end = normalize_to_epoch(args["end"], args["rollup"])

        tracked_statuses = [
            CheckInStatus.OK,
            CheckInStatus.ERROR,
            CheckInStatus.MISSED,
            CheckInStatus.TIMEOUT,
        ]

        check_ins = MonitorCheckIn.objects.filter(
            monitor=monitor,
            status__in=tracked_statuses,
            date_added__gt=args["start"],
            date_added__lte=args["end"],
        )

        environments = get_environments(request, organization)

        if environments:
            check_ins = check_ins.filter(monitor_environment__environment__in=environments)

        # Use postgres' `date_bin` to bucket rounded to our rollups
        bucket = Func(
            timedelta(seconds=args["rollup"]),
            "date_added",
            datetime.fromtimestamp(end),
            function="date_bin",
            output_field=DateTimeField(),
        )
        # Save space on date allocation and return buckets as unix timestamps
        bucket = Extract(bucket, "epoch")

        # retrieve the list of checkins in the time range and count each by
        # status. Bucketing is done at the postgres level for performance
        check_in_history = (
            check_ins.all()
            .annotate(bucket=bucket)
            .values("status", "bucket")
            .order_by("bucket")
            .annotate(count=Count("*"))
            .values_list("bucket", "status", "count")
        )

        # Duration count must be done as a second query
        duration_history = (
            check_ins.all()
            .annotate(bucket=bucket)
            .values("bucket")
            .order_by("bucket")
            .annotate(duration_avg=Avg("duration"))
            .values_list("bucket", "duration_avg")
        )

        stats = OrderedDict()
        status_to_name = dict(CheckInStatus.as_choices())

        # initialize success/failure/missed/duration stats
        while start <= end:
            stats[start] = {status_to_name[status]: 0 for status in tracked_statuses}
            stats[start]["duration"] = 0
            start += args["rollup"]

        for ts, status, count in check_in_history.iterator():
            named_status = status_to_name[status]
            stats[ts][named_status] = count

        for ts, duration_avg in duration_history.iterator():
            stats[ts]["duration"] = duration_avg

        # Ordered dict keeps timestamp order
        stats_list = [{"ts": ts, **data} for ts, data in stats.items()]

        return Response(stats_list)
