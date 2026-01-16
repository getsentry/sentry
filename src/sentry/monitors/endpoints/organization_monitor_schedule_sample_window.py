from __future__ import annotations

import math
import zoneinfo
from datetime import datetime
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
    MAX_THRESHOLD,
    MIN_THRESHOLD,
    SAMPLE_OPEN_PERIOD_RATIO,
    SAMPLE_PADDING_RATIO_OF_THRESHOLD,
    SAMPLE_PADDING_TICKS_MIN_COUNT,
)
from sentry.monitors.models import ScheduleType
from sentry.monitors.schedule import SCHEDULE_INTERVAL_MAP
from sentry.monitors.types import IntervalUnit
from sentry.monitors.validators import ConfigValidator


def _get_num_ticks(
    failure_threshold: int,
    recovery_threshold: int,
) -> int:
    total_threshold = failure_threshold + recovery_threshold

    padding_ticks = max(
        SAMPLE_PADDING_TICKS_MIN_COUNT,
        math.ceil(total_threshold * SAMPLE_PADDING_RATIO_OF_THRESHOLD),
    )

    open_period_ticks = total_threshold * SAMPLE_OPEN_PERIOD_RATIO

    return padding_ticks * 2 + failure_threshold + open_period_ticks + recovery_threshold


class SampleScheduleWindowConfigValidator(ConfigValidator):
    # TODO (Abdullah Khan): Move the default assignment to the base validator.
    # Putting it here for now to avoid breaking critical paths.
    failure_issue_threshold = serializers.IntegerField(
        min_value=MIN_THRESHOLD, max_value=MAX_THRESHOLD, default=MIN_THRESHOLD
    )
    recovery_threshold = serializers.IntegerField(
        min_value=MIN_THRESHOLD, max_value=MAX_THRESHOLD, default=MIN_THRESHOLD
    )


@region_silo_endpoint
class OrganizationMonitorScheduleSampleWindowEndpoint(OrganizationEndpoint):
    publish_status = {"GET": ApiPublishStatus.PRIVATE}
    owner = ApiOwner.CRONS

    def get(self, request: Request, organization: Organization) -> Response:
        validator = ConfigValidator(data=request.GET)
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        config = validator.validated_data

        failure_threshold = config.get("failure_issue_threshold")
        recovery_threshold = config.get("recovery_threshold")

        num_ticks = _get_num_ticks(
            failure_threshold=failure_threshold,
            recovery_threshold=recovery_threshold,
        )

        schedule_type = config.get("schedule_type")
        schedule = config.get("schedule")
        tz = zoneinfo.ZoneInfo(config.get("timezone") or "UTC")

        # Align the reference ts to the start of the hour
        reference_ts = datetime.now(tz=tz).replace(
            minute=0,
            second=0,
            microsecond=0,
        )
        ticks: list[datetime] = []
        if schedule_type == ScheduleType.CRONTAB:
            schedule_iter = CronSim(schedule, reference_ts)
            ticks = [next(schedule_iter) for _ in range(num_ticks)]

        elif schedule_type == ScheduleType.INTERVAL:
            rule = rrule.rrule(
                freq=SCHEDULE_INTERVAL_MAP[cast(IntervalUnit, schedule[1])],
                interval=schedule[0],
                dtstart=reference_ts,
                count=num_ticks,
            )
            new_date = reference_ts
            ticks.append(new_date)
            while len(ticks) < num_ticks:
                new_date = rule.after(new_date)
                ticks.append(new_date)

        return Response(
            {
                "start": int(ticks[0].timestamp()),
                "end": int(ticks[-1].timestamp()),
            }
        )
