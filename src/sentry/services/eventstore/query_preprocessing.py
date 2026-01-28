import logging
from collections import defaultdict
from collections.abc import Iterable, Mapping, Sequence
from datetime import UTC, datetime, timedelta
from typing import Any

import sentry_sdk
from django.core.cache import cache
from django.db.models import Q, QuerySet

from sentry.models.environment import Environment
from sentry.models.groupredirect import GroupRedirect

logger = logging.getLogger(__name__)

"""
Clickhouse can only handle a query of size 131072b. Our IDs are about 10b and there are
commas & spaces, so each ID ends up ~12b in the query. That gives ~10k possible group
IDs; we less-than-half that here both for breathing room and to ensure that we're still
fine if a poorly-formatted query has the same list twice.
"""
SIZE_THRESHOLD_FOR_CLICKHOUSE = 4000


def _build_group_redirect_by_group_id_cache_key(group_id: str | int) -> str:
    return f"groupredirectsforgroupid:{group_id}"


def _get_all_related_redirects_query(
    group_ids: set[str | int],
) -> QuerySet[GroupRedirect, Any]:
    return GroupRedirect.objects.filter(
        Q(group_id__in=group_ids) | Q(previous_group_id__in=group_ids)
    ).values_list("date_added", "group_id", "previous_group_id", named=True)


def _try_get_from_cache(
    group_ids: Iterable[str | int],
) -> tuple[set[tuple[str | int, datetime]], set[str | int]]:
    """
    CACHE STRUCTURE:
      group_id ==> set[(group_id, date_added)]

    Returns (all merged IDs from cache hits, all redirect IDs, all uncached input IDs)
    """
    # CACHE STRUCTURE:
    #   group_id ==> set[ tuple[group_id, redirect_id] ]
    id_to_keys = {
        group_id: _build_group_redirect_by_group_id_cache_key(group_id) for group_id in group_ids
    }
    cache_results: Mapping[str | int, set[tuple[str | int, datetime]]] = cache.get_many(
        id_to_keys.values()
    )

    cached_data = set().union(*cache_results.values())
    uncached_group_ids = {
        group_id for group_id in group_ids if id_to_keys[group_id] not in cache_results.keys()
    }

    return (cached_data, uncached_group_ids)


def get_all_merged_group_ids(
    group_ids: Iterable[str | int], threshold=SIZE_THRESHOLD_FOR_CLICKHOUSE
) -> set[str | int]:
    with sentry_sdk.start_span(op="get_all_merged_group_ids") as span:
        # Initialize all IDs with a future time to ensure they aren't filtered out.
        running_data = {
            (group_id, datetime.now(UTC) + timedelta(minutes=1)) for group_id in group_ids
        }

        # Step 1: Try to get data from cache
        cached_data, uncached_group_ids = _try_get_from_cache(group_ids)
        running_data.update(cached_data)

        # Step 2: Get unordered uncached data from Postgres
        all_related_rows = _get_all_related_redirects_query(uncached_group_ids)
        id_to_related = defaultdict(set)

        for row in all_related_rows:
            if row.date_added is None:
                continue
            running_data.add((row.group_id, row.date_added))
            running_data.add((row.previous_group_id, row.date_added))

            id_to_related[row.group_id].add((row.previous_group_id, row.date_added))
            id_to_related[row.previous_group_id].add((row.group_id, row.date_added))

        # Step 3: Set cache-missed data into cache
        cache.set_many(
            data={
                _build_group_redirect_by_group_id_cache_key(group_id): id_to_related[group_id]
                for group_id in uncached_group_ids
            },
            timeout=300,  # 5 minutes
        )

        # Step 4: If and only if result size is greater than threshold, sort by
        #         date_added and only return newest threshold # of results.
        output_set = {datum[0] for datum in running_data}
        original_count = len(output_set)
        span.set_data("true_group_id_len", original_count)

        if original_count > threshold:
            # Sort by datetime, decreasing, and then take first threshold results
            output_set = {
                datum[0]
                for datum in sorted(running_data, key=lambda datum: datum[1], reverse=True)[
                    :threshold
                ]
            }
            truncated_count = len(output_set)
            dropped_count = original_count - truncated_count
            logger.warning(
                "Dropped %d group IDs due to threshold (original: %d, threshold: %d, returned: %d)",
                dropped_count,
                original_count,
                threshold,
                truncated_count,
            )
        span.set_data("returned_group_id_len", len(output_set))

    return output_set


def translate_environment_ids_to_names(environment_ids: Sequence[int]) -> set[str]:
    return set(Environment.objects.filter(id__in=environment_ids).values_list("name", flat=True))
