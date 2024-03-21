from __future__ import annotations

import logging
from datetime import timedelta

from django.utils import timezone as django_timezone

from sentry import features
from sentry.constants import ObjectStatus
from sentry.models.organization import Organization
from sentry.monitors.models import (
    CheckInStatus,
    MonitorCheckIn,
    MonitorEnvBrokenDetection,
    MonitorIncident,
)
from sentry.tasks.base import instrumented_task
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger("sentry")

# The number of consecutive failing checkins qualifying a monitor env as broken
NUM_CONSECUTIVE_BROKEN_CHECKINS = 4

# The number of days a monitor env has to be failing to qualify as broken
NUM_DAYS_BROKEN_PERIOD = 14


@instrumented_task(
    name="sentry.monitors.tasks.detect_broken_monitor_envs",
    max_retries=0,
    time_limit=15 * 60,
    soft_time_limit=10 * 60,
    record_timing=True,
)
def detect_broken_monitor_envs():
    current_time = django_timezone.now()
    open_incidents_qs = MonitorIncident.objects.select_related("monitor").filter(
        resolving_checkin=None,
        starting_timestamp__lte=(current_time - timedelta(days=NUM_DAYS_BROKEN_PERIOD)),
        monitor__status=ObjectStatus.ACTIVE,
        monitor__is_muted=False,
        monitor_environment__is_muted=False,
        # TODO(davidenwang): When we want to email users, remove this filter
        monitorenvbrokendetection__isnull=True,
    )
    org_ids_with_open_incidents = (
        open_incidents_qs.all().values_list("monitor__organization_id", flat=True).distinct()
    )

    for org_id in org_ids_with_open_incidents:
        try:
            organization = Organization.objects.get_from_cache(id=org_id)
            if not features.has(
                "organizations:crons-broken-monitor-detection", organization=organization
            ):
                continue
        except Organization.DoesNotExist:
            continue

        orgs_open_incidents = (
            open_incidents_qs.all()
            .select_related("monitor_environment")
            .filter(monitor__organization_id=org_id)
        )
        # Query for all the broken incidents within the current org we are processing
        for open_incident in RangeQuerySetWrapper(
            orgs_open_incidents,
            order_by="starting_timestamp",
            step=1000,
        ):
            # Verify that the most recent check-ins have been failing
            recent_checkins = (
                MonitorCheckIn.objects.filter(monitor_environment=open_incident.monitor_environment)
                .order_by("-date_added")
                .values("status")[:NUM_CONSECUTIVE_BROKEN_CHECKINS]
            )
            if len(recent_checkins) != NUM_CONSECUTIVE_BROKEN_CHECKINS or not all(
                checkin["status"]
                in [CheckInStatus.ERROR, CheckInStatus.TIMEOUT, CheckInStatus.MISSED]
                for checkin in recent_checkins
            ):
                continue

            detection, _ = MonitorEnvBrokenDetection.objects.get_or_create(
                monitor_incident=open_incident, defaults={"detection_timestamp": current_time}
            )
            if not detection.user_notified_timestamp:
                # Record that we need to notify users about this broken detection via email
                pass

        # TODO(davidenwang): Send the emails here
