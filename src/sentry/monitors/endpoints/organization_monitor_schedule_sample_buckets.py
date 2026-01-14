from __future__ import annotations

import math
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
from sentry.monitors.constants import (
    SAMPLE_OPEN_PERIOD_RATIO,
    SAMPLE_PADDING_RATIO_OF_THRESHOLD,
    SAMPLE_PADDING_TICKS_MIN_COUNT,
)
from sentry.monitors.models import ScheduleType
from sentry.monitors.schedule import SCHEDULE_INTERVAL_MAP
from sentry.monitors.types import IntervalUnit
from sentry.monitors.validators import ConfigValidator


class SampleScheduleBucketsConfigValidator(ConfigValidator):
    """
    Extends the standard monitor config validator with bucket generation
    params.

    - start: unix timestamp (seconds) for the first *scheduled tick* in the
      window
    - interval: bucket size in seconds (matches rollupConfig.interval in the
      frontend)
    """

    start = serializers.IntegerField(min_value=1)
    end = serializers.IntegerField(min_value=1)
    interval = serializers.IntegerField(min_value=1)


def _get_tick_statuses(num_ticks: int, failure_threshold: int, recovery_threshold: int):
    if num_ticks <= 0:
        return []

    total_threshold = failure_threshold + recovery_threshold

    padding = max(
        SAMPLE_PADDING_TICKS_MIN_COUNT,
        math.ceil(total_threshold * SAMPLE_PADDING_RATIO_OF_THRESHOLD),
    )

    open_period = total_threshold * SAMPLE_OPEN_PERIOD_RATIO

    # We subtract one from the thresholds since the last tick is not a
    # sub-threshold tick.
    sub_failure_threshold = failure_threshold - 1
    sub_recovery_threshold = recovery_threshold - 1
    fixed_count = padding * 2 + sub_failure_threshold + sub_recovery_threshold + open_period
    if fixed_count > num_ticks:
        raise ValueError("n is too small for the given thresholds and ratios")

    remaining = num_ticks - fixed_count
    middle_errors = open_period + remaining

    return (
        ["ok"] * padding
        + ["sub_failure_error"] * sub_failure_threshold
        + ["error"] * middle_errors
        + ["sub_recovery_ok"] * sub_recovery_threshold
        + ["ok"] * padding
    )


@region_silo_endpoint
class OrganizationMonitorScheduleSampleBucketsEndpoint(OrganizationEndpoint):
    publish_status = {"GET": ApiPublishStatus.PRIVATE}
    owner = ApiOwner.CRONS

    def get(self, request: Request, organization: Organization) -> Response:
        validator = SampleScheduleBucketsConfigValidator(data=request.GET)
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        config = validator.validated_data

        failure_threshold = config.get("failure_issue_threshold")
        recovery_threshold = config.get("recovery_threshold")

        schedule_type = config.get("schedule_type")
        schedule = config.get("schedule")

        window_start_ts = int(config["start"])
        window_end_ts = int(config["end"])
        bucket_interval = int(config["interval"])
        tz = zoneinfo.ZoneInfo(config.get("timezone") or "UTC")

        window_start = datetime.fromtimestamp(window_start_ts, tz=tz)
        window_end = datetime.fromtimestamp(window_end_ts, tz=tz)

        ticks: list[datetime] = []

        if schedule_type == ScheduleType.CRONTAB:
            schedule_iter = CronSim(
                schedule,
                # Seed the simulator just before the provided first scheduled
                # tick, so the first returned tick is expected to match start.
                window_start - timedelta(seconds=1),
            )
            while True:
                dt = next(schedule_iter)
                if dt > window_end:
                    break
                ticks.append(dt)

        elif schedule_type == ScheduleType.INTERVAL:
            rule = rrule.rrule(
                freq=SCHEDULE_INTERVAL_MAP[cast(IntervalUnit, schedule[1])],
                interval=schedule[0],
                dtstart=window_start,
                until=window_end,
            )
            ticks = list(rule)

        if not ticks:
            return Response([])

        tick_statuses = _get_tick_statuses(
            num_ticks=len(ticks),
            failure_threshold=failure_threshold,
            recovery_threshold=recovery_threshold,
        )

        # Build bucketed stats in the shape FE expects:
        #   CheckInBucket = [bucketStartTs, {ok: count, error: count, ...}]
        bucket_stats: dict[int, dict[str, int]] = {}

        for i, tick_dt in enumerate(ticks):
            status = tick_statuses[i]
            tick_ts = int(tick_dt.timestamp())
            if tick_ts < window_start_ts or tick_ts > window_end_ts:
                continue

            bucket_index = (tick_ts - window_start_ts) // bucket_interval
            bucket_start = window_start_ts + bucket_index * bucket_interval
            stats = bucket_stats.setdefault(bucket_start, {})
            stats[status] = stats.get(status, 0) + 1

        duration = window_end_ts - window_start_ts
        num_buckets = (duration // bucket_interval) + 1

        # For each bucket based on the bucket interval assign a status
        # if there is a tick in the bucket, OTHERWISE assign {}.
        buckets = []
        for i in range(num_buckets):
            bucket_start = window_start_ts + i * bucket_interval
            buckets.append([bucket_start, bucket_stats.get(bucket_start, {})])

        return Response(buckets)
