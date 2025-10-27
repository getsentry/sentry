from collections.abc import Sequence

from django.db.models import Q, QuerySet

from sentry.models.groupredirect import GroupRedirect

"""
Clickhouse can only handle a query of size 131072b. Our IDs are about 10b and there are
commas & spaces, so each ID ends up ~12b in the query. That gives ~10k possible group
IDs; we quarter that here both for breathing room and to ensure that we're still fine if
a poorly-formatted query has the same list twice.
"""
SIZE_THRESHOLD_FOR_CLICKHOUSE = 2500


def _get_all_related_redirects_query(
    group_ids: set[str | int],
) -> QuerySet[GroupRedirect, tuple[int, int]]:
    return (
        GroupRedirect.objects.filter(
            Q(group_id__in=group_ids) | Q(previous_group_id__in=group_ids)
        ).values_list("group_id", "previous_group_id")
        # This order returns the newest redirects first. i.e. we're implicitly dropping
        # the oldest redirects if we have >THRESHOLD. We choose to drop the oldest
        # because they're least likely to have data in retention
        .order_by("-date_added")
    )[:SIZE_THRESHOLD_FOR_CLICKHOUSE]


def get_all_merged_group_ids(group_ids: Sequence[str | int]) -> set[str | int]:
    group_id_set = set(group_ids)
    all_related_rows = _get_all_related_redirects_query(group_id_set)
    for r in all_related_rows:
        group_id_set.update(r)
        if len(group_id_set) > SIZE_THRESHOLD_FOR_CLICKHOUSE:
            return set(group_ids)
    return group_id_set
