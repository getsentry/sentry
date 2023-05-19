from datetime import datetime, timedelta
from typing import Optional

import pytz
from sentry_sdk.crons.decorator import monitor

from sentry import features
from sentry.issues.ongoing import transition_group_to_ongoing
from sentry.models import Group, GroupStatus, Organization, OrganizationStatus, Project
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
                    last_seen_lte=int(three_days_past.timestamp()),
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
    last_seen_lte: int,
    last_seen_gte: Optional[int] = None,
    chunk_size: int = 1000,
    **kwargs,
) -> None:
    queryset = Group.objects.filter(
        project_id=project_id,
        status=GroupStatus.UNRESOLVED,
        substatus=GroupSubStatus.NEW,
        last_seen__lte=datetime.fromtimestamp(last_seen_lte, pytz.UTC),
    )

    if last_seen_gte:
        queryset = queryset.filter(last_seen__gte=datetime.fromtimestamp(last_seen_gte, pytz.UTC))

    new_groups = list(queryset.order_by("last_seen")[:chunk_size])

    for group in new_groups:
        transition_group_to_ongoing(
            GroupStatus.UNRESOLVED,
            GroupSubStatus.NEW,
            group,
        )

    if len(new_groups) == chunk_size:
        auto_transition_issues_new_to_ongoing.delay(
            project_id=project_id,
            last_seen_lte=last_seen_lte,
            last_seen_gte=new_groups[chunk_size - 1].last_seen.timestamp(),
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

    for org in RangeQuerySetWrapper(Organization.objects.filter(status=OrganizationStatus.ACTIVE)):
        if features.has("organizations:issue-states-auto-transition-regressed-ongoing", org):
            for project_id in Project.objects.filter(organization_id=org.id).values_list(
                "id", flat=True
            ):
                auto_transition_issues_regressed_to_ongoing.delay(
                    project_id=project_id,
                    last_seen_lte=int(fourteen_days_past.timestamp()),
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
    last_seen_lte: int,
    last_seen_gte: Optional[int] = None,
    chunk_size: int = 1000,
    **kwargs,
) -> None:
    queryset = Group.objects.filter(
        project_id=project_id,
        status=GroupStatus.UNRESOLVED,
        substatus=GroupSubStatus.REGRESSED,
        last_seen__lte=datetime.fromtimestamp(last_seen_lte, pytz.UTC),
    )

    if last_seen_gte:
        queryset = queryset.filter(last_seen__gte=datetime.fromtimestamp(last_seen_gte, pytz.UTC))

    regressed_groups = list(queryset.order_by("last_seen")[:chunk_size])

    for group in regressed_groups:
        transition_group_to_ongoing(
            GroupStatus.UNRESOLVED,
            GroupSubStatus.REGRESSED,
            group,
        )

    if len(regressed_groups) == chunk_size:
        auto_transition_issues_regressed_to_ongoing.delay(
            project_id=project_id,
            last_seen_lte=last_seen_lte,
            last_seen_gte=regressed_groups[chunk_size - 1].last_seen.timestamp(),
            chunk_size=chunk_size,
            expires=datetime.now(tz=pytz.UTC) + timedelta(hours=1),
        )
