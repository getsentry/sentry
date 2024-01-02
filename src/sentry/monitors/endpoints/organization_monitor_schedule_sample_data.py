from __future__ import annotations

from datetime import datetime
from typing import cast

from croniter import croniter
from dateutil import rrule
from django.utils import timezone
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

MAX_TICKS = 100


class SampleScheduleConfigValidator(ConfigValidator):
    num_ticks = serializers.IntegerField(min_value=1, max_value=MAX_TICKS)


@region_silo_endpoint
class OrganizationMonitorScheduleSampleDataEndpoint(OrganizationEndpoint):
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
        num_ticks = config.get("num_ticks")
        schedule_type = config.get("schedule_type")
        schedule = config.get("schedule")

        # Align the reference ts to the nearest hour
        reference_ts = timezone.now().replace(minute=0, second=0, microsecond=0)
        ticks: list[datetime] = []
        if schedule_type == ScheduleType.CRONTAB:
            iterator = croniter(schedule, reference_ts)
            while len(ticks) < num_ticks:
                ticks.append(iterator.get_next(datetime))

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

        return Response([int(ts.timestamp()) for ts in ticks])
