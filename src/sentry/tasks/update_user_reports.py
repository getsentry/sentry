from __future__ import absolute_import

from datetime import timedelta

from django.utils import timezone

from sentry import eventstore
from sentry.models import UserReport
from sentry.tasks.base import instrumented_task


@instrumented_task(name="sentry.tasks.update_user_reports", queue="update")
def update_user_reports(**kwargs):
    now = timezone.now()
    user_reports = UserReport.objects.filter(
        group__isnull=True, environment__isnull=True, date_added__gte=now - timedelta(days=1)
    )

    for report in user_reports:
        event = eventstore.get_event_by_id(report.project_id, report.event_id)
        if event:
            report.update(group_id=event.group_id, environment=event.get_environment())
