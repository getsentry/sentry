from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Iterable
from datetime import timedelta
from typing import Any
from urllib.parse import urlencode, urlparse, urlunparse

from django.db import router, transaction
from django.urls import reverse
from django.utils import timezone as django_timezone

from sentry.constants import ObjectStatus
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.project import Project
from sentry.models.team import Team
from sentry.monitors.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
    MonitorEnvBrokenDetection,
    MonitorIncident,
)
from sentry.notifications.services import notifications_service
from sentry.notifications.types import NotificationSettingEnum
from sentry.tasks.base import instrumented_task
from sentry.types.actor import Actor
from sentry.utils.email import MessageBuilder
from sentry.utils.email.manager import get_email_addresses
from sentry.utils.http import absolute_uri
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger("sentry")

# The number of consecutive failing checkins qualifying a monitor env as broken
NUM_CONSECUTIVE_BROKEN_CHECKINS = 4

# The number of days a monitor env has to be failing to qualify as broken
NUM_DAYS_BROKEN_PERIOD = 14

# The number of days until a monitor env is auto-muted AFTER user has been notified it was broken
NUM_DAYS_MUTED_PERIOD = 14

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


def update_user_monitor_dictionary(
    user_monitor_entries: dict[str, dict[int, Any]],
    user_email: str,
    open_incident: MonitorIncident,
    project: Project,
    environment_name: str,
) -> None:
    user_monitor_entry = user_monitor_entries[user_email][open_incident.monitor.id]
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
    if len(user_monitor_entry["environment_names"]) < MAX_ENVIRONMENTS_IN_MONITOR_LINK:
        user_monitor_entry["environment_names"].append(environment_name)


def get_user_ids_to_notify_from_monitor(monitor: Monitor, project: Project):
    try:
        if monitor.owner_user_id:
            organization_member = OrganizationMember.objects.get(
                user_id=monitor.owner_user_id, organization_id=monitor.organization_id
            )
            return [organization_member.user_id]
        elif monitor.owner_team_id:
            team = Team.objects.get_from_cache(id=monitor.owner_team_id)
            return team.member_set.values_list("user_id", flat=True)
    except (OrganizationMember.DoesNotExist, Team.DoesNotExist):
        logger.info(
            "monitors.broken_detection.invalid_owner",
            extra={
                "id": monitor.id,
                "owner_user_id": monitor.owner_user_id,
                "owner_team_id": monitor.owner_team_id,
            },
        )

    project = Project.objects.get_from_cache(id=monitor.project_id)
    return project.member_set.values_list("user_id", flat=True)


def get_user_emails_from_monitor(monitor: Monitor, project: Project):
    user_ids = get_user_ids_to_notify_from_monitor(monitor, project)
    actors = [Actor.from_id(user_id=id) for id in user_ids]
    recipients = notifications_service.get_notification_recipients(
        type=NotificationSettingEnum.BROKEN_MONITORS,
        recipients=actors,
        organization_id=project.organization_id,
        project_ids=[project.id],
    )
    filtered_user_ids = [recipient.id for recipient in (recipients.get("email") or [])]

    return get_email_addresses(filtered_user_ids, project, only_verified=True).values()


def generate_monitor_email_context(
    monitor_entries: Iterable[dict[str, Any]], organization: Organization
):
    return [
        (
            monitor_entry["slug"],
            monitor_entry["project_slug"],
            generate_monitor_detail_url(
                organization,
                monitor_entry["project_slug"],
                monitor_entry["slug"],
                monitor_entry["environment_names"],
            ),
            monitor_entry["earliest_start"],
        )
        for monitor_entry in monitor_entries
    ]


def build_open_incidents_queryset():
    current_time = django_timezone.now()
    return MonitorIncident.objects.select_related("monitor").filter(
        resolving_checkin=None,
        starting_timestamp__lte=(current_time - timedelta(days=NUM_DAYS_BROKEN_PERIOD)),
        monitor__status=ObjectStatus.ACTIVE,
        monitor__is_muted=False,
        monitor_environment__is_muted=False,
        monitorenvbrokendetection__env_muted_timestamp=None,
    )


@instrumented_task(
    name="sentry.monitors.tasks.detect_broken_monitor_envs",
    max_retries=0,
    time_limit=15 * 60,
    soft_time_limit=10 * 60,
    record_timing=True,
)
def detect_broken_monitor_envs():
    open_incidents_qs = build_open_incidents_queryset()
    org_ids_with_open_incidents = open_incidents_qs.values_list(
        "monitor__organization_id", flat=True
    ).distinct()

    for org_id in org_ids_with_open_incidents:
        detect_broken_monitor_envs_for_org.delay(org_id)


@instrumented_task(
    name="sentry.monitors.tasks.detect_broken_monitor_envs_for_org",
    max_retries=0,
    time_limit=15 * 60,
    soft_time_limit=10 * 60,
    record_timing=True,
)
def detect_broken_monitor_envs_for_org(org_id: int):
    current_time = django_timezone.now()
    try:
        organization = Organization.objects.get_from_cache(id=org_id)
    except Organization.DoesNotExist:
        return

    # Map user email to a dictionary of monitors and their earliest incident start date amongst its broken environments
    user_broken_envs: dict[str, dict[int, Any]] = defaultdict(
        lambda: defaultdict(
            lambda: {"environment_names": [], "earliest_start": django_timezone.now()}
        )
    )
    # Same as above but for monitors that will be automatically muted by us
    user_muted_envs: dict[str, dict[int, Any]] = defaultdict(
        lambda: defaultdict(
            lambda: {"environment_names": [], "earliest_start": django_timezone.now()}
        )
    )
    orgs_open_incidents = (
        build_open_incidents_queryset()
        .select_related("monitor_environment")
        .filter(monitor__organization_id=org_id)
    )
    # Query for all the broken incidents within the current org we are processing
    for open_incident in RangeQuerySetWrapper(
        orgs_open_incidents,
        step=1000,
    ):
        # Verify that the most recent check-ins have been failing
        recent_checkins = (
            MonitorCheckIn.objects.filter(monitor_environment=open_incident.monitor_environment)
            .order_by("-date_added")
            .values("status")[:NUM_CONSECUTIVE_BROKEN_CHECKINS]
        )
        if len(recent_checkins) != NUM_CONSECUTIVE_BROKEN_CHECKINS or not all(
            checkin["status"] in [CheckInStatus.ERROR, CheckInStatus.TIMEOUT, CheckInStatus.MISSED]
            for checkin in recent_checkins
        ):
            continue

        detection, _ = MonitorEnvBrokenDetection.objects.get_or_create(
            monitor_incident=open_incident, defaults={"detection_timestamp": current_time}
        )
        if not detection.user_notified_timestamp:
            environment_name = open_incident.monitor_environment.get_environment().name
            project = Project.objects.get_from_cache(id=open_incident.monitor.project_id)

            for email in get_user_emails_from_monitor(open_incident.monitor, project):
                if not email:
                    continue

                update_user_monitor_dictionary(
                    user_broken_envs, email, open_incident, project, environment_name
                )
        elif (
            not detection.env_muted_timestamp
            and detection.user_notified_timestamp + timedelta(days=NUM_DAYS_MUTED_PERIOD)
            <= current_time
        ):
            environment_name = open_incident.monitor_environment.get_environment().name
            project = Project.objects.get_from_cache(id=open_incident.monitor.project_id)

            with transaction.atomic(router.db_for_write(MonitorEnvBrokenDetection)):
                open_incident.monitor_environment.update(is_muted=True)
                detection.update(env_muted_timestamp=django_timezone.now())

            for email in get_user_emails_from_monitor(open_incident.monitor, project):
                if not email:
                    continue

                update_user_monitor_dictionary(
                    user_muted_envs, email, open_incident, project, environment_name
                )

    # After accumulating all users within the org and which monitors to email them, send the emails
    for user_email, broken_monitors in user_broken_envs.items():
        context = {
            "broken_monitors": generate_monitor_email_context(
                broken_monitors.values(), organization
            ),
            "view_monitors_link": generate_monitor_overview_url(organization),
        }
        message = MessageBuilder(
            subject="{} of your Cron Monitors {} working".format(
                len(broken_monitors), "isn't" if len(broken_monitors) == 1 else "aren't"
            ),
            template="sentry/emails/crons/broken-monitors.txt",
            html_template="sentry/emails/crons/broken-monitors.html",
            type="crons.broken_monitors",
            context=context,
        )
        message.send_async([user_email])

    for user_email, muted_monitors in user_muted_envs.items():
        context = {
            "muted_monitors": generate_monitor_email_context(muted_monitors.values(), organization),
            "view_monitors_link": generate_monitor_overview_url(organization),
        }
        message = MessageBuilder(
            subject="{} of your Cron Monitors {} been muted".format(
                len(muted_monitors), "has" if len(muted_monitors) == 1 else "have"
            ),
            template="sentry/emails/crons/muted-monitors.txt",
            html_template="sentry/emails/crons/muted-monitors.html",
            type="crons.muted_monitors",
            context=context,
        )
        message.send_async([user_email])

    # mark all open detections for this org as having had their email sent
    MonitorEnvBrokenDetection.objects.filter(
        monitor_incident__in=orgs_open_incidents, user_notified_timestamp=None
    ).update(user_notified_timestamp=django_timezone.now())
