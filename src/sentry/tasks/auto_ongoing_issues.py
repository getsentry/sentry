from datetime import datetime, timedelta
from typing import Optional

import pytz

from sentry import features
from sentry.issues.ongoing import transition_new_to_ongoing
from sentry.models import Group, GroupInbox, GroupInboxReason, Organization, Project
from sentry.tasks.base import instrumented_task


@instrumented_task(
    name="sentry.tasks.schedule_auto_transition",
    queue="auto_transition_issue_states",
    time_limit=75,
    soft_time_limit=60,
)  # type: ignore
def schedule_auto_transition() -> None:
    now = datetime.now(tz=pytz.UTC)
    for project_id in (
        GroupInbox.objects.filter(
            date_added__lte=now - timedelta(days=3),
            reason__in=(GroupInboxReason.NEW.value, GroupInboxReason.REPROCESSED.value),
        )
        .distinct()
        .values_list("project_id", flat=True)
    ):
        try:
            org = Organization.objects.get_from_cache(
                id=Project.objects.get_from_cache(id=project_id).organization_id
            )
        except Exception:
            org = Organization.objects.get(project_id=project_id)

        if features.has("organizations:issue-states-auto-transition-new-ongoing", org):
            auto_transition_issues_new_to_ongoing.delay(
                project_id=project_id,
                date_added_lte=int(now.timestamp()),
                expires=now + timedelta(hours=1),
            )


@instrumented_task(
    name="sentry.tasks.auto_transition_issues_new_to_ongoing",
    queue="auto_transition_issue_states",
    time_limit=75,
    soft_time_limit=60,
)  # type: ignore
def auto_transition_issues_new_to_ongoing(
    project_id: int,
    date_added_lte: int,
    date_added_gte: Optional[int] = None,
    chunk_size: int = 1000,
    **kwargs,
) -> None:

    queryset = GroupInbox.objects.filter(
        project_id=project_id,
        date_added__lte=datetime.utcfromtimestamp(date_added_lte),
        reason__in=(GroupInboxReason.NEW.value, GroupInboxReason.REPROCESSED.value),
    ).order_by("date_added")

    if date_added_gte:
        queryset = queryset.filter(date_added__gte=datetime.utcfromtimestamp(date_added_gte))

    new_inbox = queryset[:chunk_size]

    for group in Group.objects.filter(id__in=list({inbox.group_id for inbox in new_inbox})):
        transition_new_to_ongoing(group)

    if len(new_inbox) == chunk_size:
        auto_transition_issues_new_to_ongoing.delay(
            project_id=project_id,
            date_added_lte=datetime.utcfromtimestamp(date_added_lte),
            date_added_gte=new_inbox[chunk_size - 1].date_added,
            chunk_size=chunk_size,
            expires=datetime.now(tz=pytz.UTC) + timedelta(hours=1),
        )
