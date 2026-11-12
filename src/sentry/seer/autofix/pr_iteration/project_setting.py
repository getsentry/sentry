from __future__ import annotations

from sentry.models.group import Group


def pr_iteration_enabled_for_group(group_id: int) -> bool:
    """Whether the group's project lets Autofix iterate on its PRs automatically.

    A missing group is not this gate's to report, so it reads as enabled and the
    caller's own lookup surfaces it.
    """
    try:
        group = Group.objects.get_from_cache(id=group_id)
    except Group.DoesNotExist:
        return True
    return bool(group.project.get_option("sentry:seer_pr_iteration"))
