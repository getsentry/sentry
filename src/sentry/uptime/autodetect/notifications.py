from __future__ import annotations
from typing import int

import logging

from sentry import features
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import uptime_tasks
from sentry.uptime.models import get_uptime_subscription
from sentry.uptime.types import UptimeMonitorMode
from sentry.utils.email import MessageBuilder
from sentry.utils.email.manager import get_email_addresses
from sentry.utils.http import absolute_uri
from sentry.workflow_engine.models.detector import Detector

logger = logging.getLogger(__name__)


def get_user_ids_to_notify_from_project(project: Project):
    """
    Get all user IDs who should be notified about auto-detected monitors in a project.
    This returns all members of teams that are part of the project.
    """
    return project.member_set.values_list("user_id", flat=True)


def get_user_emails_from_project(project: Project):
    """
    Get verified email addresses for users who should be notified about auto-detected monitors.
    """
    user_ids = get_user_ids_to_notify_from_project(project)
    return get_email_addresses(user_ids, project, only_verified=True).values()


def generate_uptime_monitor_overview_url(organization: Organization):
    """Generate URL to the uptime monitoring overview page."""
    return absolute_uri(f"/organizations/{organization.slug}/insights/uptime/")


def generate_uptime_monitor_detail_url(
    organization: Organization, project_slug: str, detector_id: int
):
    """Generate URL to a specific uptime monitor's detail page."""
    return absolute_uri(
        f"/organizations/{organization.slug}/issues/alerts/rules/uptime/{project_slug}/{detector_id}/details/"
    )


@instrumented_task(
    name="sentry.uptime.tasks.send_auto_detected_notifications",
    namespace=uptime_tasks,
    processing_deadline_duration=5 * 60,
)
def send_auto_detected_notifications(detector_id: int) -> None:
    """
    Send an email notification to project members when an uptime monitor graduates
    from onboarding to active monitoring.

    Args:
        detector_id: The ID of the Detector instance that has graduated to active monitoring
    """
    try:
        detector = Detector.objects.get(id=detector_id)
    except Detector.DoesNotExist:
        return

    mode = detector.config.get("mode")
    if mode != UptimeMonitorMode.AUTO_DETECTED_ACTIVE:
        return

    project = Project.objects.get_from_cache(id=detector.project_id)
    organization = project.organization

    if not features.has("organizations:uptime-auto-detected-monitor-emails", organization):
        return

    uptime_subscription = get_uptime_subscription(detector)
    user_emails = list(get_user_emails_from_project(project))

    if not user_emails:
        logger.info(
            "uptime.autodetect.no_emails_to_notify",
            extra={
                "detector_id": detector.id,
                "project_id": project.id,
                "organization_id": organization.id,
            },
        )
        return

    monitor_detail_url = generate_uptime_monitor_detail_url(organization, project.slug, detector.id)
    view_monitors_link = generate_uptime_monitor_overview_url(organization)

    context = {
        "monitor_url_display": uptime_subscription.url,
        "monitor_detail_url": monitor_detail_url,
        "project_slug": project.slug,
        "date_created": detector.date_added,
        "view_monitors_link": view_monitors_link,
    }

    message = MessageBuilder(
        subject="We've Created a Free Uptime Monitor for Your Project",
        template="sentry/emails/uptime/auto-detected-monitors.txt",
        html_template="sentry/emails/uptime/auto-detected-monitors.html",
        type="uptime.auto_detected_monitors",
        context=context,
    )
    message.send_async(user_emails)

    logger.info(
        "uptime.autodetect.email_sent",
        extra={
            "detector_id": detector.id,
            "project_id": project.id,
            "organization_id": organization.id,
            "num_recipients": len(user_emails),
        },
    )
