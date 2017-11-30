from __future__ import absolute_import

from sentry.models import Group, UserReport
from sentry.tasks.base import instrumented_task, retry


@instrumented_task(
    name='sentry.tasks.user_reports.backfill_group',
    queue='cleanup',
    default_retry_delay=60,
    max_retries=5,
)
@retry(exclude=(UserReport.DoesNotExist, ))
def backfill_group(report_id, **kwargs):
    report = UserReport.objects.filter(
        id=report_id,
    ).select_related('project').get()

    if report.group_id is None:
        report.group = Group.objects.from_event_id(
            report.project,
            report.event_id,
        )

        report.save()
