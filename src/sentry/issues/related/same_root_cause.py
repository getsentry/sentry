# Module to evaluate if groups have the same root cause
#
# The first case this module handles is environmental failures.
#
# Refer to README in module for more details.
from sentry.models.group import Group
from sentry.utils.query import RangeQuerySetWrapper


def same_root_cause_analysis(group: Group) -> tuple[list[int], dict[str, str]]:
    """Analyze and create a group set if the group was caused by the same root cause."""
    # Querying the data field (which is a GzippedDictField) cannot be done via
    # Django's ORM, thus, we do so via compare_groups
    project_groups = RangeQuerySetWrapper(
        Group.objects.filter(project=group.project_id).exclude(id=group.id),
        limit=100,
    )
    same_error_type_groups = [g.id for g in project_groups if compare_groups(g, group)]
    return same_error_type_groups or [], {}


def compare_groups(groupA: Group, groupB: Group) -> bool:
    return match_criteria(
        {"title": groupA.title, "type": groupA.get_event_type()},
        {"title": groupB.title, "type": groupB.get_event_type()},
    )


def match_criteria(a: dict[str, str | None], b: dict[str, str | None]) -> bool:
    # XXX: In future iterations we will be able to use similar titles rather than an exact match
    return a["type"] == b["type"] and a["title"] == b["title"]
