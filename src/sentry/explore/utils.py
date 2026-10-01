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


def shift_starred_positions(
    organization: Organization,
    user_id: int,
    *,
    from_position: int,
    delta: int,
    inclusive: bool = False,
) -> None:
    """
    Move every position above ``from_position`` by ``delta``, closing a gap in the shared list of starred queries.
    If ``inclusive`` is True, ``from_position`` itself is included in the shift. By default it is not.
    """

    if inclusive:
        ExploreSavedQueryStarred.objects.filter(
            organization=organization, user_id=user_id, position__gte=from_position
        ).update(position=models.F("position") + delta)

        DiscoverSavedQueryStarred.objects.filter(
            organization=organization, user_id=user_id, position__gte=from_position
        ).update(position=models.F("position") + delta)
    else:
        ExploreSavedQueryStarred.objects.filter(
            organization=organization, user_id=user_id, position__gt=from_position
        ).update(position=models.F("position") + delta)

        DiscoverSavedQueryStarred.objects.filter(
            organization=organization, user_id=user_id, position__gt=from_position
        ).update(position=models.F("position") + delta)


def reorder_starred_queries(
    organization: Organization, user_id: int, refs: Sequence[SavedQueryRef]
) -> None:
    """
    Reorders ``refs`` to positions across Discover and Explore tables.

    Can accept a subset of starred queries and reordering is done among the provided refs.
    In addition, all positions are normalized to 1...N, where N is the number of starred queries.

    Raises:
        ValueError: if ``refs`` names a query the user has not starred, or names the
            same query twice
    """
    requested_query_refs = list(refs)
    set_of_refs = set(requested_query_refs)
    if len(set_of_refs) != len(requested_query_refs):
        raise ValueError("Single query cannot take up multiple positions.")

    # grab all starred queries in both tables, and map based on SavedQueryRef.
    discover_starred_queries = DiscoverSavedQueryStarred.objects.filter(
        organization=organization, user_id=user_id, position__isnull=False, starred=True
    )

    explore_starred_queries = ExploreSavedQueryStarred.objects.filter(
        organization=organization, user_id=user_id, position__isnull=False, starred=True
    )

    existing_query_refs: dict[
        SavedQueryRef, DiscoverSavedQueryStarred | ExploreSavedQueryStarred
    ] = {}
    for discover_row in discover_starred_queries:
        existing_query_refs[
            SavedQueryRef(SavedQueryType.DISCOVER, discover_row.discover_saved_query_id)
        ] = discover_row

    for explore_row in explore_starred_queries:
        existing_query_refs[
            SavedQueryRef(SavedQueryType.EXPLORE, explore_row.explore_saved_query_id)
        ] = explore_row

    if not set_of_refs.issubset(existing_query_refs):
        raise ValueError("Mismatch between existing and provided starred queries.")

    # A deterministic tiebreaker in case a race condition allowed both tables to secure the same position
    new_order = sorted(
        existing_query_refs,
        key=lambda ref: (existing_query_refs[ref].position or 0, ref.type, ref.query_id),
    )

    # Subset of starred queries should only reorder amongst themselves
    new_positions = [index for index, ref in enumerate(new_order) if ref in set_of_refs]
    for position, ref in zip(new_positions, requested_query_refs):
        new_order[position] = ref

    discover_updates: list[DiscoverSavedQueryStarred] = []
    explore_updates: list[ExploreSavedQueryStarred] = []
    # Normalize positions from 1..N
    for position, ref in enumerate(new_order, start=1):
        row = existing_query_refs[ref]
        row.position = position
        if isinstance(row, DiscoverSavedQueryStarred):
            discover_updates.append(row)
        else:
            explore_updates.append(row)

    ExploreSavedQueryStarred.objects.bulk_update(explore_updates, ["position"])
    DiscoverSavedQueryStarred.objects.bulk_update(discover_updates, ["position"])
