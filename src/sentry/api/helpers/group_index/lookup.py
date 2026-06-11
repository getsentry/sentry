from __future__ import annotations

from collections.abc import Sequence

from sentry.models.group import Group
from sentry.models.project import Project


def get_group_list(
    organization_id: int,
    projects: Sequence[Project],
    group_ids: Sequence[int | str],
) -> list[Group]:
    """
    Gets group list based on provided filters.

    Args:
        organization_id: ID of the organization
        projects: Sequence of projects to filter groups by
        group_ids: Sequence of specific group IDs to fetch

    Returns: List of Group objects filtered to only valid groups in the org/projects
    """
    groups: list[Group] = []
    # Convert all group IDs to integers and filter out any non-integer values
    group_ids_int = [int(gid) for gid in group_ids if str(gid).isdigit()]
    if group_ids_int:
        return list(
            Group.objects.filter(
                project__organization_id=organization_id, project__in=projects, id__in=group_ids_int
            ).select_related("project")
        )
    else:
        project_ids = [p.id for p in projects]
        for group_id in group_ids:
            if isinstance(group_id, str):
                try:
                    group = Group.objects.by_qualified_short_id(
                        organization_id, group_id, project_ids=project_ids
                    )
                except Group.DoesNotExist:
                    continue
                groups.append(group)

    return groups
