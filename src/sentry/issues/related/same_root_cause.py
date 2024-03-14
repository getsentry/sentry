# Module to evaluate if groups have the same root cause
#
# The first two cases this module handles are:
# * environmental failures
# * buggy code paths
#
# Refer to README in module for more details.
from typing import Any

from sentry.models.group import Group


def same_root_cause_analysis(group: Group) -> list[Group] | None:
    """Analyze and create a group set if the group was caused by the same root cause."""
    # XXX: This function is not optimal since we can't query the data field which is a GzippedDictField
    project_groups = Group.objects.filter(project=group.project_id)
    same_error_type_groups = [g for g in project_groups if compare_groups(g, group)]
    return same_error_type_groups


def compare_groups(groupA: Group, groupB: Group) -> bool:
    return match_criteria(_extract_values(groupA), _extract_values(groupB))


def match_criteria(a: dict[str, str | None], b: dict[str, str | None]) -> bool:
    # XXX: In future iterations we will be able to use similar titles rather than an exact match
    return a["type"] == b["type"] and a["title"] == b["title"]


def _extract_values(group: Group) -> dict[str, Any]:
    return {"title": group.title, "type": group.data.get("metadata", {}).get("type")}
