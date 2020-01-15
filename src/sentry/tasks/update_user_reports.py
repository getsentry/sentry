from __future__ import absolute_import

from datetime import timedelta
import logging

from django.utils import timezone

from sentry import eventstore
from sentry.models import UserReport
from sentry.tasks.base import instrumented_task

logger = logging.getLogger(__name__)


@instrumented_task(name="sentry.tasks.update_user_reports", queue="update")
def update_user_reports(**kwargs):
    now = timezone.now()
    user_reports = UserReport.objects.filter(
        group__isnull=True, environment__isnull=True, date_added__gte=now - timedelta(days=1)
    )

    project_ids = [r.project_id for r in user_reports]
    event_ids = [r.event_id for r in user_reports]
    report_by_event = {r.event_id: r for r in user_reports}

    snuba_filter = eventstore.Filter(project_ids=project_ids, event_ids=event_ids)
    events = eventstore.get_events(filter=snuba_filter)

    total_reports = len(user_reports)
    reports_with_event = 0
    updated_reports = 0

    for event in events:
        report = report_by_event.get(event.event_id)
        if report:
            reports_with_event += 1
            report.update(group_id=event.group_id, environment=event.get_environment())
            updated_reports += 1

    logger.info(
        "update_user_reports.records_updated",
        extra={
            "reports_to_update": total_reports,
            "reports_with_event": reports_with_event,
            "updated_reports": updated_reports,
        },
    )
