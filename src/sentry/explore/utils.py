from __future__ import annotations

from collections.abc import Sequence

from django.db import models

from sentry import features
from sentry.discover.models import DiscoverSavedQueryStarred
from sentry.explore.models import ExploreSavedQueryStarred
from sentry.explore.types import SavedQueryRef, SavedQueryType
from sentry.models.organization import Organization
from sentry.users.models.user import User


def is_logs_enabled(organization: Organization, actor: User | None = None) -> bool:
    """
    Check if logs are enabled for the given organization.
    This replaces individual feature flag checks for consolidated ourlogs features.
    """
    return features.has("organizations:ourlogs-enabled", organization, actor=actor)


def is_trace_metrics_enabled(organization: Organization, actor: User | None = None) -> bool:
    """
    Check if trace metrics are enabled for the given organization.
    This replaces individual feature flag checks for consolidated tracemetrics features.
    """
    return features.has("organizations:tracemetrics-enabled", organization, actor=actor)


def next_starred_position(organization: Organization, user_id: int) -> int:
    """
    The position for a star appended to the end of the shared list.

    This is just the maximum position across Discover and Explore tables, plus one.
    If the user has no starred queries, returns 1.
    """
    highest_in_discover = (
        DiscoverSavedQueryStarred.objects.filter(
            organization=organization, user_id=user_id, position__isnull=False
        )
        .order_by("-position")
        .first()
    )

    highest_in_explore = (
        ExploreSavedQueryStarred.objects.filter(
            organization=organization, user_id=user_id, position__isnull=False
        )
        .order_by("-position")
        .first()
    )

    positions = [
        row.position
        for row in (highest_in_discover, highest_in_explore)
        if row is not None and row.position is not None
    ]

    return max(positions, default=0) + 1


def shift_starred_positions_by_one(
    organization: Organization,
    user_id: int,
    *,
    from_position: int,
) -> None:
    """
    Move every position above ``from_position`` by negative one, closing a gap in the shared list of starred queries.
    """

    ExploreSavedQueryStarred.objects.filter(
        organization=organization, user_id=user_id, position__gt=from_position
    ).update(position=models.F("position") - 1)

    DiscoverSavedQueryStarred.objects.filter(
        organization=organization, user_id=user_id, position__gt=from_position
    ).update(position=models.F("position") - 1)


def reorder_starred_queries(
    organization: Organization, user_id: int, refs: Sequence[SavedQueryRef]
) -> None:
    """
    Reorders ``refs`` to positions, in the order given, across Discover and Explore tables.

    Both tables are always read, and the positions are normalized to 1...N,
    where N is the number of starred queries. Therefore, this has to have every
    starred query the user has, not just those of one product.

    Raises:
        ValueError: if ``refs`` is not exactly the set of the user's starred rows, or
            contains a duplicate.
    """
    requested = list(refs)
    if len(requested) != len(set(requested)):
        raise ValueError("Single query cannot take up multiple positions.")

    # grab all starred queries in both tables, and map based on SavedQueryRef.
    discover_starred_queries = DiscoverSavedQueryStarred.objects.filter(
        organization=organization, user_id=user_id, position__isnull=False
    ).filter(organization=organization, user_id=user_id, position__isnull=False, starred=True)

    explore_starred_queries = ExploreSavedQueryStarred.objects.filter(
        organization=organization, user_id=user_id, position__isnull=False, starred=True
    )

    combined_starred_queries_map: dict[
        SavedQueryRef, DiscoverSavedQueryStarred | ExploreSavedQueryStarred
    ] = {}
    for discover_row in discover_starred_queries:
        combined_starred_queries_map[
            SavedQueryRef(SavedQueryType.DISCOVER, discover_row.discover_saved_query_id)
        ] = discover_row

    for explore_row in explore_starred_queries:
        combined_starred_queries_map[
            SavedQueryRef(SavedQueryType.EXPLORE, explore_row.explore_saved_query_id)
        ] = explore_row

    if combined_starred_queries_map.keys() != set(requested):
        raise ValueError("Mismatch between existing and provided starred queries.")

    # normalize positions to 1...N, then assign them in order of the ref sequence provided
    slots = range(1, len(requested) + 1)

    discover_updates: list[DiscoverSavedQueryStarred] = []
    explore_updates: list[ExploreSavedQueryStarred] = []
    for ref, new_position in zip(requested, slots):
        row = combined_starred_queries_map[ref]
        row.position = new_position
        if isinstance(row, ExploreSavedQueryStarred):
            explore_updates.append(row)
        else:
            discover_updates.append(row)

    ExploreSavedQueryStarred.objects.bulk_update(explore_updates, ["position"])
    DiscoverSavedQueryStarred.objects.bulk_update(discover_updates, ["position"])
