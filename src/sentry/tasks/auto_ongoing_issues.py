from datetime import datetime, timedelta

import pytz

from sentry import features
from sentry.issues.ongoing import transition_new_to_ongoing
from sentry.models import Group, GroupInboxReason, Project
from sentry.tasks.base import instrumented_task
from sentry.utils.query import RangeQuerySetWrapper


@instrumented_task(name="sentry.tasks.schedule_auto_transition", time_limit=75, soft_time_limit=60)
def schedule_auto_transition():
    now = datetime.now(tz=pytz.UTC)
    for project in Project.objects.filter(
        groupinbox__date_added__lte=now - timedelta(days=3),
        groupinbox__reason__in=(GroupInboxReason.NEW.value, GroupInboxReason.REPROCESSED.value),
    ).distinct():
        if features.has(
            "organizations:issue-states-auto-transition-new-ongoing", project.organization
        ):
            auto_transition_issues_new_to_ongoing.delay(
                project_id=project.id, expires=now + timedelta(hours=1)
            )


@instrumented_task(
    name="sentry.tasks.auto_transition_issues_new_to_ongoing", time_limit=75, soft_time_limit=60
)
def auto_transition_issues_new_to_ongoing(
    project_id: int, cutoff=None, chunk_size: int = 1000, **kwargs
) -> None:
    now = datetime.now(tz=pytz.UTC)

    for group in RangeQuerySetWrapper(
        Group.objects.filter(
            groupinbox__project_id=project_id,
            groupinbox__date_added__lte=now - timedelta(days=3),
            groupinbox__reason__in=(GroupInboxReason.NEW.value, GroupInboxReason.REPROCESSED.value),
        ).distinct()
    ):
        transition_new_to_ongoing(group)
