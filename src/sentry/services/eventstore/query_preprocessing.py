from collections.abc import Sequence

from django.db.models import Q

from sentry.models.groupredirect import GroupRedirect


def get_all_merged_group_ids(group_ids: Sequence[str | int]) -> set[str | int]:
    group_id_set = set(group_ids)
    all_related_rows = GroupRedirect.objects.filter(
        Q(group_id__in=group_id_set) | Q(previous_group_id__in=group_id_set)
    ).values_list("group_id", "previous_group_id")
    for r in all_related_rows:
        group_id_set.update(r)
    return group_id_set
