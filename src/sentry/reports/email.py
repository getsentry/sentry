from __future__ import annotations

import logging

from django.utils import timezone

from sentry.models.organization import Organization
from sentry.reports.models import ScheduledReport, ScheduledReportFrequency
from sentry.users.services.user.service import user_service
from sentry.utils.email.message_builder import MessageBuilder
from sentry.utils.email.send import send_messages
from sentry.utils.http import absolute_uri

logger = logging.getLogger(__name__)

FREQUENCY_DISPLAY = {
    ScheduledReportFrequency.DAILY: "Daily",
    ScheduledReportFrequency.WEEKLY: "Weekly",
    ScheduledReportFrequency.MONTHLY: "Monthly",
}


def send_report_email(
    scheduled_report: ScheduledReport,
    filename: str,
    file_bytes: bytes,
    mimetype: str,
    organization: Organization,
    empty_result: bool = False,
) -> None:
    """Send the generated report file to all recipients via email."""
    freq_label = FREQUENCY_DISPLAY.get(scheduled_report.frequency, "Scheduled")
    time_display = f"{freq_label} at {scheduled_report.hour}:00 UTC"

    message = MessageBuilder(
        subject=f"Scheduled Report: {scheduled_report.name}",
        template="sentry/emails/scheduled-report.txt",
        html_template="sentry/emails/scheduled-report.html",
        type="report.scheduled",
        context={
            "report_name": scheduled_report.name,
            "frequency": time_display,
            "organization_name": organization.name,
            "generated_at": timezone.now(),
            "settings_url": absolute_uri(f"/settings/{organization.slug}/"),
            "empty_result": empty_result,
        },
    )

    for email in scheduled_report.recipient_emails:
        try:
            msg = message.build(to=email)
            msg.attach(filename, file_bytes, mimetype)
            send_messages([msg])
        except Exception:
            logger.exception(
                "scheduled_report.email_send_failed",
                extra={"report_id": scheduled_report.id, "recipient": email},
            )


def notify_report_deactivated(
    scheduled_report: ScheduledReport,
    organization: Organization,
    reason: str,
) -> None:
    """Notify the report creator that their scheduled report was deactivated."""
    if not scheduled_report.created_by_id:
        return

    creator = user_service.get_user(user_id=scheduled_report.created_by_id)
    if not creator or not creator.email:
        return

    reason_messages = {
        "source_deleted": "The source query or dashboard has been deleted.",
        "unsupported_dataset": "The source query uses a dataset that is no longer supported for scheduled reports.",
    }
    reason_text = reason_messages.get(reason, "An unexpected issue occurred.")

    try:
        message = MessageBuilder(
            subject=f"Scheduled Report Deactivated: {scheduled_report.name}",
            template="sentry/emails/scheduled-report-deactivated.txt",
            html_template="sentry/emails/scheduled-report-deactivated.html",
            type="report.scheduled.deactivated",
            context={
                "report_name": scheduled_report.name,
                "organization_name": organization.name,
                "reason": reason_text,
                "settings_url": absolute_uri(f"/settings/{organization.slug}/"),
            },
        )
        message.send(to=[creator.email])
    except Exception:
        logger.exception(
            "scheduled_report.deactivation_notify_failed",
            extra={"report_id": scheduled_report.id},
        )
