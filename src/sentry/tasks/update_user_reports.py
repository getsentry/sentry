import logging
from datetime import datetime, timedelta

import sentry_sdk
from django.utils import timezone

from sentry import eventstore, quotas
from sentry.feedback.lib.utils import FeedbackCreationSource, is_in_feedback_denylist
from sentry.feedback.usecases.shim_to_feedback import shim_to_feedback
from sentry.models.project import Project
from sentry.models.userreport import UserReport
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import issues_tasks
from sentry.utils import metrics
from sentry.utils.iterators import chunked

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.update_user_reports",
    queue="update",
    silo_mode=SiloMode.REGION,
    taskworker_config=TaskworkerConfig(
        namespace=issues_tasks,
        processing_deadline_duration=30,
    ),
)
def update_user_reports(
    start_datetime: str | None = None,
    end_datetime: str | None = None,
    max_events: int | None = None,
    event_lookback_days: int | None = None,
) -> None:
    now = timezone.now()
    start = now - timedelta(days=1)
    # +5 minutes just to catch clock skew
    end = now + timedelta(minutes=5)

    if start_datetime:
        start = datetime.fromisoformat(start_datetime)
    if end_datetime:
        end = datetime.fromisoformat(end_datetime)

    # The event query time range is [start - event_lookback, end].
    if event_lookback_days is None:
        event_lookback_days = 1
    event_lookback = timedelta(days=event_lookback_days)

    # Filter for user reports where there was no event associated with them at
    # ingestion time
    user_reports = UserReport.objects.filter(
        group_id__isnull=True,
        date_added__gte=start,
        date_added__lte=end,
    )

    # We do one query per project, just to avoid the small case that two projects have the same event ID
    project_map: dict[int, list[UserReport]] = {}
    for r in user_reports:
        project_map.setdefault(r.project_id, []).append(r)

    # Logging values
    total_reports = len(user_reports)
    updated_reports = 0
    samples = None

    # the default max_query_size is 256 KiB, which we're hitting with 5000 events, so keeping it safe at 2000
    MAX_EVENTS = max_events or 2000
    for project_id, reports in project_map.items():
        project = Project.objects.get(id=project_id)
        event_ids = [r.event_id for r in reports]
        report_by_event = {r.event_id: r for r in reports}
        events = []

        event_start = start - event_lookback
        if retention := quotas.backend.get_event_retention(organization=project.organization):
            event_start = max(event_start, now - timedelta(days=retention))

        for event_id_chunk in chunked(event_ids, MAX_EVENTS):
            snuba_filter = eventstore.Filter(
                project_ids=[project_id],
                event_ids=event_id_chunk,
                start=event_start,
                end=end,
            )
            try:
                events_chunk = eventstore.backend.get_events(
                    filter=snuba_filter, referrer="tasks.update_user_reports"
                )
                events.extend(events_chunk)
            except Exception:
                sentry_sdk.set_tag("update_user_reports.eventstore_query_failed", True)
                logger.exception(
                    "update_user_reports.eventstore_query_failed",
                    extra={"project_id": project_id, "start": start, "end": end},
                )  # will also send exc to Sentry
                metrics.incr("tasks.update_user_reports.eventstore_query_failed")

        for event in events:
            report = report_by_event.get(event.event_id)
            if report:
                if report.environment_id is None:
                    if not is_in_feedback_denylist(project.organization):
                        metrics.incr("tasks.update_user_reports.shim_to_feedback")
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
                # XXX(aliu): If a report has environment_id but not group_id, this report was shimmed from a feedback issue, so no need to shim again.
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
