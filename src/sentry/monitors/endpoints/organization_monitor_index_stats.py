from __future__ import annotations

from collections import OrderedDict, defaultdict
from datetime import datetime, timedelta
from typing import List, MutableMapping

from django.db.models import Count, DateTimeField, Func
from django.db.models.functions import Extract
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import StatsMixin, region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.helpers.environments import get_environments
from sentry.monitors.models import CheckInStatus, Monitor, MonitorCheckIn
from sentry.utils.dates import to_timestamp


def normalize_to_epoch(timestamp: datetime, seconds: int):
    """
    Given a ``timestamp`` (datetime object) normalize to an epoch timestamp.

    i.e. if the rollup is minutes, the resulting timestamp would have
    the seconds and microseconds rounded down.
    """
    epoch = int(to_timestamp(timestamp))
    return epoch - (epoch % seconds)


@region_silo_endpoint
class OrganizationMonitorIndexStatsEndpoint(OrganizationEndpoint, StatsMixin):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    # TODO(epurkhiser): probably convert to snuba
    def get(self, request: Request, organization) -> Response:
        # Do not restrict rollups allowing us to define custom resolutions.
        # Important for this endpoint since we want our buckets to align with
        # the UI's timescale markers.
        args = self._parse_args(request, restrict_rollups=False)

        start = normalize_to_epoch(args["start"], args["rollup"])
        end = normalize_to_epoch(args["end"], args["rollup"])

        monitor_slugs: List[str] = request.GET.getlist("monitor")

        tracked_statuses = [
            CheckInStatus.IN_PROGRESS,
            CheckInStatus.OK,
            CheckInStatus.ERROR,
            CheckInStatus.MISSED,
            CheckInStatus.TIMEOUT,
        ]

        monitor_ids = Monitor.objects.filter(
            organization_id=organization.id,
            slug__in=monitor_slugs,
        ).values("id")

        check_ins = MonitorCheckIn.objects.filter(
            monitor_id__in=monitor_ids,
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
            datetime.fromtimestamp(start),
            function="date_bin",
            output_field=DateTimeField(),
        )
        # Save space on date allocation and return buckets as unix timestamps
        bucket = Extract(bucket, "epoch")

        # retrieve the list of checkins in the time range and count each by
        # status. Bucketing is done at the postgres level for performance
        history = (
            check_ins.all()
            .annotate(bucket=bucket)
            .values(
                "bucket",
                "monitor__slug",
                "monitor_environment__environment",
                "status",
            )
            .order_by("monitor__slug", "bucket")
            .annotate(count=Count("*"))
            .values_list(
                "monitor__slug",
                "bucket",
                "monitor_environment__environment__name",
                "status",
                "count",
            )
        )

        status_to_name = dict(CheckInStatus.as_choices())

        StatusStats = MutableMapping[str, int]

        def status_obj_factory() -> StatusStats:
            return {status_to_name[status]: 0 for status in tracked_statuses}

        # Mapping chain of monitor_id -> timestamp[] -> monitor_env_names -> StatusStats
        EnvToStatusMapping = MutableMapping[int, StatusStats]
        TsToEnvsMapping = MutableMapping[int, EnvToStatusMapping]
        MonitorToTimestampsMapping = MutableMapping[str, TsToEnvsMapping]

        # Use ordered dict for timestamp -> envs mapping since we want to
        # maintain the ordering of the timestamps
        stats: MonitorToTimestampsMapping = defaultdict(OrderedDict)

        # initialize mappings
        for slug in monitor_slugs:
            ts = start
            while ts <= end:
                stats[slug][ts] = defaultdict(status_obj_factory)
                ts += args["rollup"]

        for slug, ts, env_name, status, count in history.iterator():
            named_status = status_to_name[status]
            stats[slug][ts][env_name][named_status] = count

        # Flatten the timestamp to env mapping dict into a tuple list, this
        # maintains the ordering
        stats_list = {
            slug: [[ts, env_mapping] for ts, env_mapping in ts_to_envs.items()]
            for slug, ts_to_envs in stats.items()
        }

        return Response(stats_list)
