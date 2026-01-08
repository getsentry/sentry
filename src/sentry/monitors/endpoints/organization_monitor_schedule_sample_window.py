from __future__ import annotations

import zoneinfo
from datetime import datetime
from math import ceil
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
from sentry.monitors.validators import ConfigValidator


class SampleScheduleConfigValidator(ConfigValidator):
    failureThreshold = serializers.IntegerField(min_value=1)
    recoveryThreshold = serializers.IntegerField(min_value=1)


@region_silo_endpoint
class OrganizationMonitorScheduleSampleWindowEndpoint(OrganizationEndpoint):
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

        validator = SampleScheduleConfigValidator(data=config_data)
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        config = validator.validated_data
        failure_threshold: int = config["failureThreshold"]
        recovery_threshold: int = config["recoveryThreshold"]

        # Determine the number of ticks to request from the thresholds.
        #
        # We model the sample window like:
        #   10% success ticks (padding) +
        #   0-20% error ticks (failureThreshold) +
        #   60% error ticks (open period) +
        #   0-20% success ticks (recoveryThreshold) +
        #   10% success ticks (padding)
        #
        # Let T = failureThreshold + recoveryThreshold.
        # - open period = 3T (≈60% of total)
        # - each padding = ceil(T/2) (≈10% of total)
        total_threshold = failure_threshold + recovery_threshold
        padding_ticks = ceil(total_threshold / 2)
        open_period_ticks = total_threshold * 3
        num_ticks = (
            padding_ticks
            + failure_threshold
            + open_period_ticks
            + recovery_threshold
            + padding_ticks
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
