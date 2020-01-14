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

    count = 0
    updated = 0
    for report in user_reports:
        count += 1
        event = eventstore.get_event_by_id(report.project_id, report.event_id)
        if event:
            report.update(group_id=event.group_id, environment=event.get_environment())
            updated += 1

    logger.info(
        "update_user_reports.records_updated",
        extra={"records_updated": updated, "records_to_update": count},
    )
