from __future__ import annotations

import logging

from django.utils import timezone

from sentry.explore.models import ExploreSavedQuery
from sentry.features import has as feature_has
from sentry.models.dashboard import Dashboard
from sentry.reports.email import notify_report_deactivated, send_report_email
from sentry.reports.generate import generate_csv_for_explore_query
from sentry.reports.models import (
    VALID_EXPLORE_DATASETS,
    ScheduledReport,
    ScheduledReportSourceType,
)
from sentry.reports.schedule import compute_next_run_at
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import reports_tasks
from sentry.taskworker.retry import Retry

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.reports.tasks.schedule_reports",
    namespace=reports_tasks,
    retry=Retry(times=1),
    silo_mode=SiloMode.REGION,
)
def schedule_reports() -> None:
    """Find all active reports that are due and dispatch execution tasks."""
    now = timezone.now()
    due_reports = ScheduledReport.objects.filter(
        is_active=True,
        next_run_at__lte=now,
    ).select_related("organization")

    for report in due_reports:
        if not feature_has("organizations:scheduled-reports", report.organization):
            continue

        next_run = compute_next_run_at(report, now=now)
        updated = ScheduledReport.objects.filter(
            id=report.id,
            next_run_at__lte=now,
        ).update(next_run_at=next_run)

        if updated:
            execute_scheduled_report.delay(report.id)


@instrumented_task(
    name="sentry.reports.tasks.execute_scheduled_report",
    namespace=reports_tasks,
    retry=Retry(times=3, delay=60),
    processing_deadline_duration=120,
    silo_mode=SiloMode.REGION,
)
def execute_scheduled_report(scheduled_report_id: int) -> None:
    """Generate and deliver a single scheduled report."""
    try:
        report = ScheduledReport.objects.select_related("organization").get(id=scheduled_report_id)
    except ScheduledReport.DoesNotExist:
        return

    organization = report.organization

    if report.source_type == ScheduledReportSourceType.EXPLORE_SAVED_QUERY:
        try:
            sq = ExploreSavedQuery.objects.get(id=report.source_id, organization_id=organization.id)
            if sq.dataset not in VALID_EXPLORE_DATASETS:
                logger.info(
                    "scheduled_report.unsupported_dataset",
                    extra={"report_id": report.id, "dataset": sq.dataset},
                )
                report.is_active = False
                report.save(update_fields=["is_active"])
                notify_report_deactivated(report, organization, reason="unsupported_dataset")
                return
        except ExploreSavedQuery.DoesNotExist:
            pass

    try:
        empty_result = False
        if report.source_type == ScheduledReportSourceType.DASHBOARD:
            logger.info(
                "scheduled_report.dashboard_not_supported",
                extra={"report_id": report.id},
            )
            return
        elif report.source_type == ScheduledReportSourceType.EXPLORE_SAVED_QUERY:
            filename, file_bytes, empty_result = generate_csv_for_explore_query(
                report, organization
            )
            mimetype = "text/csv"
        else:
            logger.error(
                "scheduled_report.unknown_source_type",
                extra={"report_id": report.id},
            )
            return
    except (ExploreSavedQuery.DoesNotExist, Dashboard.DoesNotExist):
        logger.info(
            "scheduled_report.source_deleted",
            extra={"report_id": report.id},
        )
        report.is_active = False
        report.save(update_fields=["is_active"])
        notify_report_deactivated(report, organization, reason="source_deleted")
        return
    except Exception:
        logger.exception(
            "scheduled_report.generation_failed",
            extra={
                "report_id": report.id,
                "source_type": report.source_type,
                "source_id": report.source_id,
            },
        )
        raise

    if report.recipient_emails:
        send_report_email(report, filename, file_bytes, mimetype, organization, empty_result)
