import logging
from datetime import timedelta
from typing import Any

from django.utils import timezone

from sentry import eventstore, features
from sentry.feedback.usecases.create_feedback import FeedbackCreationSource, shim_to_feedback
from sentry.models.project import Project
from sentry.models.userreport import UserReport
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.utils.iterators import chunked

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.update_user_reports",
    queue="update",
    silo_mode=SiloMode.REGION,
)
def update_user_reports(**kwargs: Any) -> None:
    now = timezone.now()
    end = kwargs.get("end", now + timedelta(minutes=5))  # +5 minutes just to catch clock skew
    start = kwargs.get("start", now - timedelta(days=1))
    # Filter for user reports where there was no event associated with them at
    # ingestion time
    user_reports = UserReport.objects.filter(
        group_id__isnull=True,
        environment_id__isnull=True,
        date_added__gte=start,
        date_added__lte=end,
    )

    # We do one query per project, just to avoid the small case that two projects have the same event ID
    project_map: dict[int, Any] = {}
    for r in user_reports:
        project_map.setdefault(r.project_id, []).append(r)

    # Logging values
    total_reports = len(user_reports)
    updated_reports = 0
    samples = None

    MAX_EVENTS = kwargs.get(
        "max_events",
        2000,  # the default max_query_size is 256 KiB, which we're hitting with 5000 events, so keeping it safe at 2000
    )
    for project_id, reports in project_map.items():
        project = Project.objects.get(id=project_id)
        event_ids = [r.event_id for r in reports]
        report_by_event = {r.event_id: r for r in reports}
        events = []
        for event_id_chunk in chunked(event_ids, MAX_EVENTS):
            snuba_filter = eventstore.Filter(
                project_ids=[project_id],
                event_ids=event_id_chunk,
                start=start - timedelta(days=1),  # we go one extra day back for events
                end=end,
            )
            events_chunk = eventstore.backend.get_events(
                filter=snuba_filter, referrer="tasks.update_user_reports"
            )
            events.extend(events_chunk)

        for event in events:
            report = report_by_event.get(event.event_id)
            if report:
                if features.has(
                    "organizations:user-feedback-ingest", project.organization, actor=None
                ):
                    logger.info(
                        "update_user_reports.shim_to_feedback",
                        extra={"report_id": report.id, "event_id": event.event_id},
                    )
                    shim_to_feedback(
                        {
                            "name": report.name,
                            "email": report.email,
                            "comments": report.comments,
                            "event_id": report.event_id,
                            "level": "error",
                        },
                        event,
                        project,
                        FeedbackCreationSource.UPDATE_USER_REPORTS_TASK,
                    )
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
            "updated_reports": updated_reports,
            "samples": samples,
        },
    )
