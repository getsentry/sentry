from collections.abc import Sequence

from django.db.models import Q

from sentry.models.groupredirect import GroupRedirect


def get_all_merged_group_ids(group_ids: Sequence[str | int]) -> set[str | int]:
    all_related_rows = GroupRedirect.objects.filter(
        Q(group_id__in=group_ids) | Q(previous_group_id__in=group_ids)
    ).values_list("group_id", "previous_group_id")
    out = set(group_ids)
    for r in all_related_rows:
        out = out.union(r)
    return out
