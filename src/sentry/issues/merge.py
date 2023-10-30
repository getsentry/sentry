from __future__ import annotations

from typing import Dict, Sequence, TypedDict
from uuid import uuid4

import rest_framework

from sentry import eventstream
from sentry.issues.grouptype import GroupCategory
from sentry.models.activity import Activity
from sentry.models.group import Group, GroupStatus
from sentry.models.project import Project
from sentry.models.user import User
from sentry.tasks.merge import merge_groups
from sentry.types.activity import ActivityType


class MergedGroup(TypedDict):
    parent: str
    children: list[str]


def handle_merge(
    group_list: Sequence[Group],
    project_lookup: Dict[int, Project],
    acting_user: User | None,
) -> MergedGroup:
    """
    Merge a list of groups into a single group.

    Returns a dict with the primary group id and a list of the merged group ids.
    """
    if any([group.issue_category != GroupCategory.ERROR for group in group_list]):
        raise rest_framework.exceptions.ValidationError(
            detail="Only error issues can be merged.", code=400
        )

    group_list_by_times_seen = sorted(group_list, key=lambda g: (g.times_seen, g.id), reverse=True)
    primary_group, groups_to_merge = group_list_by_times_seen[0], group_list_by_times_seen[1:]

    group_ids_to_merge = [g.id for g in groups_to_merge]
    eventstream_state = eventstream.backend.start_merge(
        primary_group.project_id, group_ids_to_merge, primary_group.id
    )

    Group.objects.filter(id__in=group_ids_to_merge).update(status=GroupStatus.PENDING_MERGE)

    transaction_id = uuid4().hex
    merge_groups.delay(
        from_object_ids=group_ids_to_merge,
        to_object_id=primary_group.id,
        transaction_id=transaction_id,
        eventstream_state=eventstream_state,
    )

    Activity.objects.create(
        project=project_lookup[primary_group.project_id],
        group=primary_group,
        type=ActivityType.MERGE.value,
        user_id=acting_user.id if acting_user else None,
        data={"issues": [{"id": c.id} for c in groups_to_merge]},
    )

    return MergedGroup(
        parent=str(primary_group.id),
        children=[str(g.id) for g in groups_to_merge],
    )
