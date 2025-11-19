from collections.abc import Iterable

import sentry_sdk
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
        # because they're least likely to have data in retention.
        # Technically id != date_added, but it's a close appx (& much faster).
        .order_by("-id")
    )


def get_all_merged_group_ids(
    group_ids: Iterable[str | int], threshold=SIZE_THRESHOLD_FOR_CLICKHOUSE
) -> set[str | int]:
    with sentry_sdk.start_span(op="get_all_merged_group_ids") as span:
        group_id_set = set(group_ids)
        all_related_rows = _get_all_related_redirects_query(group_id_set)

        threshold_breaker_set = None

        for r in all_related_rows:
            group_id_set.update(r)

            # We only want to set the threshold_breaker the first time that we cross
            # the threshold.
            if threshold_breaker_set is None and len(group_id_set) >= threshold:
                # Because we're incrementing the size of group_id_set by either one or two
                # each iteration, it's fine if we're a bit over. That's negligible compared
                # to the scale-of-thousands Clickhouse threshold.
                threshold_breaker_set = group_id_set.copy()

        out = group_id_set if threshold_breaker_set is None else threshold_breaker_set

        span.set_data("true_group_id_len", len(group_id_set))
        span.set_data("returned_group_id_len", len(out))

    return out
