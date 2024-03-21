from __future__ import annotations

import logging
from collections import defaultdict
from datetime import timedelta
from urllib.parse import urlencode, urlparse, urlunparse

from django.urls import reverse
from django.utils import timezone as django_timezone

from sentry import features
from sentry.constants import ObjectStatus
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.monitors.models import (
    CheckInStatus,
    MonitorCheckIn,
    MonitorEnvBrokenDetection,
    MonitorIncident,
)
from sentry.tasks.base import instrumented_task
from sentry.utils.email import MessageBuilder
from sentry.utils.http import absolute_uri
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger("sentry")

# The number of consecutive failing checkins qualifying a monitor env as broken
NUM_CONSECUTIVE_BROKEN_CHECKINS = 4

# The number of days a monitor env has to be failing to qualify as broken
NUM_DAYS_BROKEN_PERIOD = 14

# Max number of environments to have in the broken monitor email link
MAX_ENVIRONMENTS_IN_MONITOR_LINK = 10


def generate_monitor_overview_url(organization: Organization):
    return absolute_uri(reverse("sentry-organization-crons", args=[organization.slug]))


def generate_monitor_detail_url(
    organization: Organization, project_slug: str, monitor_slug: str, environments: list[str]
):
    url = absolute_uri(
        reverse(
            "sentry-organization-cron-monitor-details",
            args=[organization.slug, project_slug, monitor_slug],
        )
    )
    url_parts = list(urlparse(url))
    url_parts[4] = urlencode({"environment": environments}, doseq=True)
    return urlunparse(url_parts)


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
        # TODO(davidenwang): Once we start disabling environments, change accordingly
        monitorenvbrokendetection__user_notified_timestamp=None,
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

        # Map user email to a dictionary of monitors and their earliest incident start date amongst its broken environments
        user_broken_envs = defaultdict(
            lambda: defaultdict(
                lambda: {"environment_names": [], "earliest_start": django_timezone.now()}
            )
        )
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
                environment_name = open_incident.monitor_environment.get_environment().name
                project = Project.objects.get_from_cache(id=open_incident.monitor.project_id)
                for user in project.member_set:
                    if not user.user_email:
                        continue

                    user_monitor_entry = user_broken_envs[user.user_email][open_incident.monitor.id]
                    user_monitor_entry.update(
                        {
                            "earliest_start": min(
                                open_incident.starting_timestamp,
                                user_monitor_entry["earliest_start"],
                            ),
                            "project_slug": project.slug,
                            "slug": open_incident.monitor.slug,
                        }
                    )
                    if (
                        len(user_monitor_entry["environment_names"])
                        < MAX_ENVIRONMENTS_IN_MONITOR_LINK
                    ):
                        user_monitor_entry["environment_names"].append(environment_name)

        # After accumulating all users within the org and which monitors to email them, send the emails
        for user_email, broken_monitors in user_broken_envs.items():
            broken_monitors_context = [
                (
                    monitor_entry["slug"],
                    generate_monitor_detail_url(
                        organization,
                        monitor_entry["project_slug"],
                        monitor_entry["slug"],
                        monitor_entry["environment_names"],
                    ),
                    monitor_entry["earliest_start"],
                )
                for monitor_entry in broken_monitors.values()
            ]

            context = {
                "broken_monitors": broken_monitors_context,
                "view_monitors_link": generate_monitor_overview_url(organization),
            }
            message = MessageBuilder(
                subject="Your monitors are broken!",
                template="sentry/emails/crons/broken-monitors.txt",
                html_template="sentry/emails/crons/broken-monitors.html",
                type="crons.broken_monitors",
                context=context,
            )
            message.send_async([user_email])

        # mark all open detections for this org as having had their email sent
        MonitorEnvBrokenDetection.objects.filter(
            monitor_incident__in=orgs_open_incidents, user_notified_timestamp=None
        ).update(user_notified_timestamp=django_timezone.now())
