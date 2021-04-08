import logging
from datetime import timedelta

from django.utils import timezone

from sentry import eventstore
from sentry.models import UserReport
from sentry.tasks.base import instrumented_task

logger = logging.getLogger(__name__)


@instrumented_task(name="sentry.tasks.update_user_reports", queue="update")
def update_user_reports(**kwargs):
    now = timezone.now()
    user_reports = UserReport.objects.filter(
        group_id__isnull=True, environment_id__isnull=True, date_added__gte=now - timedelta(days=1)
    )

    # We do one query per project, just to avoid the small case that two projects have the same event ID
    project_map = {}
    for r in user_reports:
        project_map.setdefault(r.project_id, []).append(r)

    # Logging values
    total_reports = len(user_reports)
    reports_with_event = 0
    updated_reports = 0
    samples = None

    for project_id, reports in project_map.items():
        event_ids = [r.event_id for r in reports]
        report_by_event = {r.event_id: r for r in reports}
        snuba_filter = eventstore.Filter(
            project_ids=[project_id],
            event_ids=event_ids,
            start=now - timedelta(days=2),
            end=now + timedelta(minutes=5),  # Just to catch clock skew
        )
        events = eventstore.get_events(filter=snuba_filter)

        for event in events:
            report = report_by_event.get(event.event_id)
            if report:
                reports_with_event += 1
                report.update(group_id=event.group_id, environment_id=event.get_environment().id)
                updated_reports += 1

        if not samples and len(reports) <= 10:
            samples = {
                "project_id": project_id,
                "event_ids": event_ids,
                "reports_event_ids": {r.id: r.event_id for r in reports},
            }

    logger.info(
        "update_user_reports.records_updated",
        extra={
            "reports_to_update": total_reports,
            "reports_with_event": reports_with_event,
            "updated_reports": updated_reports,
            "samples": samples,
        },
    )
