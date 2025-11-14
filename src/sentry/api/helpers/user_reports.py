from typing import int
from collections.abc import Sequence

from sentry.models.group import Group, GroupStatus
from sentry.models.userreport import UserReport


def user_reports_filter_to_unresolved(user_reports: Sequence[UserReport]) -> list[UserReport]:
    group_ids = {ur.group_id for ur in user_reports if ur.group_id}
    unresolved_group_ids = set()
    if group_ids:
        unresolved_group_ids = set(
            Group.objects.filter(id__in=group_ids, status=GroupStatus.UNRESOLVED).values_list(
                "id", flat=True
            )
        )
    return [ur for ur in user_reports if ur.group_id is None or ur.group_id in unresolved_group_ids]
