from __future__ import annotations

import zoneinfo
from datetime import datetime, timedelta
from typing import cast

from cronsim import CronSim
from dateutil import rrule
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.models.organization import Organization
from sentry.monitors.models import ScheduleType
from sentry.monitors.schedule import SCHEDULE_INTERVAL_MAP
from sentry.monitors.types import IntervalUnit
from sentry.monitors.utils import get_schedule_sample_window_tick_groups
from sentry.monitors.validators import ConfigValidator


class SampleScheduleBucketsConfigValidator(ConfigValidator):
    """
    Extends the standard monitor config validator with bucket generation
    params.

    - start: unix timestamp (seconds) for the first *scheduled tick* in the
      window
    - interval: bucket size in seconds (matches rollupConfig.interval in the frontend)
    """

    start = serializers.IntegerField()
    interval = serializers.IntegerField()


# Expand grouped tick statuses into a per-tick list.
# Input:  [{"status": "ok", "count": 3}, {"status": "error", "count": 2}]
# Output: ["ok", "ok", "ok", "error", "error"]
def _status_by_tick_index(
    tick_groups: list[dict[str, int | str]],
) -> list[str]:
    statuses: list[str] = []
    for group in tick_groups:
        status = cast(str, group["status"])
        count = cast(int, group["count"])
        statuses.extend([status] * count)
    return statuses


@region_silo_endpoint
class OrganizationMonitorScheduleSampleBucketsEndpoint(OrganizationEndpoint):
    publish_status = {"GET": ApiPublishStatus.PRIVATE}
    owner = ApiOwner.CRONS

    def get(self, request: Request, organization: Organization) -> Response:
        # Convert query params to a form the validator can use
        config_data: dict[str, list | str] = {}
        for key, val in request.GET.lists():
            if key == "schedule" and len(val) > 1:
                config_data[key] = [int(val[0]), val[1]]
            else:
                config_data[key] = val[0]

        validator = SampleScheduleBucketsConfigValidator(data=config_data)
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        config = validator.validated_data

        failure_threshold = config.get("failure_issue_threshold")
        recovery_threshold = config.get("recovery_threshold")
        if failure_threshold is None or recovery_threshold is None:
            errors = {}
            if failure_threshold is None:
                errors["failure_issue_threshold"] = ["This field is required."]
            if recovery_threshold is None:
                errors["recovery_threshold"] = ["This field is required."]
            return self.respond(errors, status=400)

        tick_groups = get_schedule_sample_window_tick_groups(
            failure_threshold=failure_threshold,
            recovery_threshold=recovery_threshold,
        )
        tick_statuses = _status_by_tick_index(tick_groups)
        num_ticks = len(tick_statuses)

        schedule_type = config.get("schedule_type")
        schedule = config.get("schedule")
        tz = zoneinfo.ZoneInfo(config.get("timezone") or "UTC")

        window_start_ts = int(config["start"])
        bucket_interval = int(config["interval"])

        window_start = datetime.fromtimestamp(window_start_ts, tz=tz)
        ticks: list[datetime] = []

        if schedule_type == ScheduleType.CRONTAB:
            # Seed the simulator just before the provided first scheduled tick,
            # so the first returned tick is expected to match start.
            schedule_iter = CronSim(schedule, window_start - timedelta(seconds=1))
            ticks = [next(schedule_iter) for _ in range(num_ticks)]

        elif schedule_type == ScheduleType.INTERVAL:
            rule = rrule.rrule(
                freq=SCHEDULE_INTERVAL_MAP[cast(IntervalUnit, schedule[1])],
                interval=schedule[0],
                dtstart=window_start,
                count=num_ticks,
            )
            new_date = window_start
            ticks.append(new_date)
            while len(ticks) < num_ticks:
                new_date = rule.after(new_date)
                ticks.append(new_date)

        window_end_ts = int(ticks[-1].timestamp())

        # Build bucketed stats in the shape FE expects:
        #   CheckInBucket = [bucketStartTs, {ok: count, error: count, ...}]
        bucket_stats: dict[int, dict[str, int]] = {}

        for tick_dt, status in zip(ticks, tick_statuses):
            tick_ts = int(tick_dt.timestamp())
            if tick_ts < window_start_ts or tick_ts > window_end_ts:
                continue

            bucket_index = (tick_ts - window_start_ts) // bucket_interval
            bucket_start = window_start_ts + bucket_index * bucket_interval
            stats = bucket_stats.setdefault(bucket_start, {})
            stats[status] = stats.get(status, 0) + 1

        duration = window_end_ts - window_start_ts
        num_buckets = (duration // bucket_interval) + 1

        buckets = []
        for i in range(num_buckets):
            bucket_start = window_start_ts + i * bucket_interval
            buckets.append([bucket_start, bucket_stats.get(bucket_start, {})])

        return Response(buckets)
