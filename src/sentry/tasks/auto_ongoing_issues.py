from datetime import datetime, timedelta
from typing import Optional

import pytz
from django.db.models import Max
from sentry_sdk.crons.decorator import monitor

from sentry import features
from sentry.issues.ongoing import transition_group_to_ongoing
from sentry.models import (
    Group,
    GroupHistoryStatus,
    GroupStatus,
    Organization,
    OrganizationStatus,
    Project,
)
from sentry.tasks.base import instrumented_task
from sentry.types.group import GroupSubStatus
from sentry.utils.query import RangeQuerySetWrapper


@instrumented_task(
    name="sentry.tasks.schedule_auto_transition_new",
    queue="auto_transition_issue_states",
)  # type: ignore
@monitor(monitor_slug="schedule_auto_transition_new")
def schedule_auto_transition_new() -> None:
    now = datetime.now(tz=pytz.UTC)
    three_days_past = now - timedelta(days=3)

    for org in RangeQuerySetWrapper(Organization.objects.filter(status=OrganizationStatus.ACTIVE)):
        if features.has("organizations:issue-states-auto-transition-new-ongoing", org):
            for project_id in Project.objects.filter(organization_id=org.id).values_list(
                "id", flat=True
            ):
                auto_transition_issues_new_to_ongoing.delay(
                    project_id=project_id,
                    first_seen_lte=int(three_days_past.timestamp()),
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
    first_seen_lte: int,
    first_seen_gte: Optional[int] = None,
    chunk_size: int = 1000,
    **kwargs,
) -> None:
    queryset = Group.objects.filter(
        project_id=project_id,
        status=GroupStatus.UNRESOLVED,
        substatus=GroupSubStatus.NEW,
        first_seen__lte=datetime.fromtimestamp(first_seen_lte, pytz.UTC),
    )

    if first_seen_gte:
        queryset = queryset.filter(first_seen__gte=datetime.fromtimestamp(first_seen_gte, pytz.UTC))

    new_groups = list(queryset.order_by("first_seen")[:chunk_size])

    for group in new_groups:
        transition_group_to_ongoing(
            GroupStatus.UNRESOLVED,
            GroupSubStatus.NEW,
            group,
        )

    if len(new_groups) == chunk_size:
        auto_transition_issues_new_to_ongoing.delay(
            project_id=project_id,
            first_seen_lte=first_seen_lte,
            first_seen_gte=new_groups[chunk_size - 1].first_seen.timestamp(),
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
    three_days_past = now - timedelta(days=3)

    for org in RangeQuerySetWrapper(Organization.objects.filter(status=OrganizationStatus.ACTIVE)):
        if features.has("organizations:issue-states-auto-transition-regressed-ongoing", org):
            for project_id in Project.objects.filter(organization_id=org.id).values_list(
                "id", flat=True
            ):
                auto_transition_issues_regressed_to_ongoing.delay(
                    project_id=project_id,
                    date_added_lte=int(three_days_past.timestamp()),
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
    queryset = (
        Group.objects.filter(
            project_id=project_id,
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.REGRESSED,
            grouphistory__status=GroupHistoryStatus.REGRESSED,
        )
        .annotate(recent_regressed_history=Max("grouphistory__date_added"))
        .filter(recent_regressed_history__lte=datetime.fromtimestamp(date_added_lte, pytz.UTC))
    )

    if date_added_gte:
        queryset = queryset.filter(
            recent_regressed_history__gte=datetime.fromtimestamp(date_added_gte, pytz.UTC)
        )

    groups_with_regressed_history = list(queryset.order_by("recent_regressed_history")[:chunk_size])

    for group in groups_with_regressed_history:
        transition_group_to_ongoing(
            GroupStatus.UNRESOLVED,
            GroupSubStatus.REGRESSED,
            group,
        )

    if len(groups_with_regressed_history) == chunk_size:
        auto_transition_issues_regressed_to_ongoing.delay(
            project_id=project_id,
            date_added_lte=date_added_lte,
            date_added_gte=groups_with_regressed_history[
                chunk_size - 1
            ].recent_regressed_history.timestamp(),
            chunk_size=chunk_size,
            expires=datetime.now(tz=pytz.UTC) + timedelta(hours=1),
        )
