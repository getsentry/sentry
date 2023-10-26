from datetime import datetime

from croniter import croniter
from dateutil import rrule
from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.models.organization import Organization
from sentry.monitors.schedule import SCHEDULE_INTERVAL_MAP


@region_silo_endpoint
class OrganizationMonitorScheduleSampleDataEndpoint(OrganizationEndpoint):
    def get(self, request: Request, organization: Organization) -> Response:
        num_ticks = int(request.GET.get("numTicks", 0))
        schedule_type = request.GET.get("scheduleType")
        cron_schedule = request.GET.get("cronSchedule")
        interval = int(request.GET.get("interval", 0))
        frequency = request.GET.get("frequency")

        if not num_ticks or num_ticks > 100 or not schedule_type:
            # return error
            return self.respond([], status=400)

        # Align the reference ts to the nearest hour
        reference_ts = timezone.now().replace(minute=0, second=0, microsecond=0)
        ticks = []
        if schedule_type == "crontab":
            if not cron_schedule:
                return self.respond(ticks, status=400)

            iterator = croniter(cron_schedule, reference_ts)
            while len(ticks) < num_ticks:
                ticks.append(iterator.get_next(datetime))

        elif schedule_type == "interval":
            if not interval or not frequency:
                return self.respond(ticks, status=400)

            rule = rrule.rrule(
                freq=SCHEDULE_INTERVAL_MAP[frequency],
                interval=interval,
                dtstart=reference_ts,
                count=num_ticks,
            )
            new_date = reference_ts
            ticks.append(new_date)
            while len(ticks) < num_ticks:
                new_date = rule.after(new_date)
                ticks.append(new_date)

        return self.respond(ticks)
