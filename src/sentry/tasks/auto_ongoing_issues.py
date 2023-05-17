from datetime import datetime, timedelta
from typing import Optional

import pytz
from sentry_sdk.crons.decorator import monitor

from sentry import features
from sentry.issues.ongoing import transition_new_to_ongoing, transition_regressed_to_ongoing
from sentry.models import Group, GroupInbox, GroupInboxReason, Organization, Project
from sentry.tasks.base import instrumented_task


@instrumented_task(
    name="sentry.tasks.schedule_auto_transition_new",
    queue="auto_transition_issue_states",
)  # type: ignore
@monitor(monitor_slug="schedule_auto_transition_new")
def schedule_auto_transition_new() -> None:
    now = datetime.now(tz=pytz.UTC)
    three_days_past = now - timedelta(days=3)

    for project_id in (
        GroupInbox.objects.filter(
            date_added__lte=three_days_past,
            reason__in=(GroupInboxReason.NEW.value, GroupInboxReason.REPROCESSED.value),
        )
        .distinct()
        .values_list("project_id", flat=True)
    ):
        org = Organization.objects.get_from_cache(
            id=Project.objects.get_from_cache(id=project_id).organization_id
        )

        if features.has("organizations:issue-states-auto-transition-new-ongoing", org):
            auto_transition_issues_new_to_ongoing.delay(
                project_id=project_id,
                date_added_lte=int(three_days_past.timestamp()),
                expires=now + timedelta(hours=1),
            )


@instrumented_task(
    name="sentry.tasks.auto_transition_issues_new_to_ongoing",
    queue="auto_transition_issue_states",
    time_limit=25 * 60,
    soft_time_limit=20 * 60,
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
        date_added__lte=datetime.fromtimestamp(date_added_lte, pytz.UTC),
        reason__in=(GroupInboxReason.NEW.value, GroupInboxReason.REPROCESSED.value),
    )

    if date_added_gte:
        queryset = queryset.filter(date_added__gte=datetime.fromtimestamp(date_added_gte, pytz.UTC))

    new_inbox = queryset.order_by("date_added")[:chunk_size]

    for group in Group.objects.filter(id__in=list({inbox.group_id for inbox in new_inbox})):
        transition_new_to_ongoing(group)

    if len(new_inbox) == chunk_size:
        auto_transition_issues_new_to_ongoing.delay(
            project_id=project_id,
            date_added_lte=date_added_lte,
            date_added_gte=new_inbox[chunk_size - 1].date_added.timestamp(),
            chunk_size=chunk_size,
            expires=datetime.now(tz=pytz.UTC) + timedelta(hours=1),
        )


@instrumented_task(
    name="sentry.tasks.schedule_auto_transition_regressed",
    queue="auto_transition_issue_states",
)  # type: ignore
@monitor(monitor_slug="schedule_auto_transition_regressed")
def schedule_auto_transition_regressed() -> None:
    now = datetime.now(tz=pytz.UTC)
    fourteen_days_past = now - timedelta(days=14)

    for project_id in (
        GroupInbox.objects.filter(
            date_added__lte=fourteen_days_past,
            reason=GroupInboxReason.REGRESSION.value,
        )
        .distinct()
        .values_list("project_id", flat=True)
    ):
        org = Organization.objects.get_from_cache(
            id=Project.objects.get_from_cache(id=project_id).organization_id
        )

        if features.has("organizations:issue-states-auto-transition-regressed-ongoing", org):
            auto_transition_issues_regressed_to_ongoing.delay(
                project_id=project_id,
                date_added_lte=int(fourteen_days_past.timestamp()),
                expires=now + timedelta(hours=1),
            )


@instrumented_task(
    name="sentry.tasks.auto_transition_issues_regressed_to_ongoing",
    queue="auto_transition_issue_states",
    time_limit=25 * 60,
    soft_time_limit=20 * 60,
)  # type: ignore
def auto_transition_issues_regressed_to_ongoing(
    project_id: int,
    date_added_lte: int,
    date_added_gte: Optional[int] = None,
    chunk_size: int = 1000,
    **kwargs,
) -> None:

    queryset = GroupInbox.objects.filter(
        project_id=project_id,
        date_added__lte=datetime.fromtimestamp(date_added_lte, pytz.UTC),
        reason=GroupInboxReason.REGRESSION.value,
    )

    if date_added_gte:
        queryset = queryset.filter(date_added__gte=datetime.fromtimestamp(date_added_gte, pytz.UTC))

    regressed_inbox = queryset.order_by("date_added")[:chunk_size]

    for group in Group.objects.filter(id__in=list({inbox.group_id for inbox in regressed_inbox})):
        transition_regressed_to_ongoing(group)

    if len(regressed_inbox) == chunk_size:
        auto_transition_issues_regressed_to_ongoing.delay(
            project_id=project_id,
            date_added_lte=date_added_lte,
            date_added_gte=regressed_inbox[chunk_size - 1].date_added.timestamp(),
            chunk_size=chunk_size,
            expires=datetime.now(tz=pytz.UTC) + timedelta(hours=1),
        )
