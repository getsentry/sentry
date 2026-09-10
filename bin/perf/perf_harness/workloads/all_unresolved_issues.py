from __future__ import annotations

from datetime import timedelta
from typing import Any

from django.db import connection
from django.utils import timezone
from rest_framework.response import Response

from perf_harness.workload import EndpointContext, Workload, integer_parameters
from sentry.models.group import Group, GroupStatus
from sentry.models.groupassignee import GroupAssignee
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus


def build_workload(self: EndpointContext, parameters: dict[str, Any]) -> Workload:
    parameters = integer_parameters(
        parameters,
        {
            "groups": (10_000, 1, None),
            "members": (50, 1, None),
            "projects": (3, 1, None),
            "background_groups": (0, 0, None),
            "assigned_percent": (100, 1, 100),
            "history_per_group": (2, 0, 10),
        },
    )
    group_count = parameters["groups"]
    member_count = parameters["members"]
    project_count = parameters["projects"]
    background_count = parameters["background_groups"]
    assigned_percent = parameters["assigned_percent"]
    history_per_group = parameters["history_per_group"]
    self.endpoint = "sentry-api-0-team-all-unresolved-issues"

    projects = [self.create_project(teams=[self.team]) for _ in range(project_count)]
    for _ in range(member_count - 1):
        user = self.create_user()
        self.create_member(
            organization=self.organization,
            user=user,
            teams=[self.team],
        )
    member_ids = list(self.team.member_set.values_list("user_id", flat=True))
    other_team = self.create_team(organization=self.organization)

    current_time = timezone.now()
    groups = Group.objects.bulk_create(
        [
            Group(
                project=projects[index % project_count],
                message=f"database profile issue {index}",
                status=GroupStatus.UNRESOLVED,
                first_seen=current_time - timedelta(days=index % 7),
                last_seen=current_time,
            )
            for index in range(group_count)
        ],
        batch_size=1_000,
    )
    GroupAssignee.objects.bulk_create(
        [
            GroupAssignee(
                project_id=group.project_id,
                group_id=group.id,
                team_id=(
                    other_team.id
                    if index % 100 >= assigned_percent
                    else self.team.id
                    if index % 2 == 0
                    else None
                ),
                user_id=(
                    member_ids[(index // 100 + index // 2) % len(member_ids)]
                    if index % 100 < assigned_percent and index % 2
                    else None
                ),
            )
            for index, group in enumerate(groups)
        ],
        batch_size=1_000,
    )
    history_statuses = (
        GroupHistoryStatus.UNRESOLVED,
        GroupHistoryStatus.RESOLVED,
        GroupHistoryStatus.REGRESSED,
    )
    GroupHistory.objects.bulk_create(
        [
            GroupHistory(
                organization_id=self.organization.id,
                project_id=group.project_id,
                group_id=group.id,
                status=history_statuses[history_index % len(history_statuses)],
                date_added=current_time - timedelta(days=history_index % 7),
            )
            for group in groups
            for history_index in range(history_per_group)
        ],
        batch_size=1_000,
    )

    background_project = self.create_project(teams=[other_team])
    for offset in range(0, background_count, 1_000):
        background_groups = Group.objects.bulk_create(
            [
                Group(
                    project=background_project,
                    message=f"background profile issue {index}",
                    status=GroupStatus.UNRESOLVED,
                    first_seen=current_time - timedelta(days=30),
                    last_seen=current_time,
                )
                for index in range(offset, min(offset + 1_000, background_count))
            ],
            batch_size=1_000,
        )
        GroupAssignee.objects.bulk_create(
            [
                GroupAssignee(
                    project_id=group.project_id,
                    group_id=group.id,
                    user_id=member_ids[(offset + index) % len(member_ids)],
                )
                for index, group in enumerate(background_groups)
            ],
            batch_size=1_000,
        )

    assert connection.get_autocommit()
    with connection.cursor() as cursor:
        cursor.execute(
            "VACUUM (ANALYZE) sentry_groupedmessage, sentry_groupasignee, sentry_grouphistory"
        )

    self.login_as(user=self.user)

    expected_count = sum(index % 100 < assigned_percent for index in range(group_count))

    def validate(response: Response) -> None:
        assert response.status_code == 200
        assert set(response.data) == {project.id for project in projects}
        assert (
            sum(buckets[max(buckets)]["unresolved"] for buckets in response.data.values())
            == expected_count
        )

    return Workload(
        operation=lambda: self.get_success_response(
            self.organization.slug, self.team.slug, statsPeriod="7d"
        ),
        validate=validate,
        parameters=parameters,
        should_explain=lambda query: any(
            table in query.sql
            for table in (
                "sentry_groupedmessage",
                "sentry_groupasignee",
                "sentry_grouphistory",
            )
        ),
        snapshot=lambda response: [response.data[project.id] for project in projects],
    )
