from __future__ import annotations

import hashlib
from collections import defaultdict
from collections.abc import Iterator, Sequence
from dataclasses import dataclass
from enum import StrEnum

from django.apps import apps
from django.db import connections, models, router, transaction
from django.db.models import Max

from sentry.models.organization import Organization

"""
Part of the migration of discover queries to explore queries.
This module provides a unified interface to the two starred tables
"""


# Will move this to a more appropriate location once a
class SavedQueryType(StrEnum):
    DISCOVER = "discover"
    EXPLORE = "explore"


@dataclass(frozen=True)
class SavedQueryRef:
    """
    A saved query identified across products.

    ``type`` is either discover or explore
    ``id`` is the associated primary key for that query
    """

    type: SavedQueryType
    id: int


# (app_label, model name, column naming the saved query) per product. Models are resolved
# lazily through the app registry because both model modules import this one, so importing
# them here at module scope would be circular.
_TABLES: dict[SavedQueryType, tuple[str, str, str]] = {
    SavedQueryType.DISCOVER: (
        "discover",
        "DiscoverSavedQueryStarred",
        "discover_saved_query_id",
    ),
    SavedQueryType.EXPLORE: ("explore", "ExploreSavedQueryStarred", "explore_saved_query_id"),
}


def _tables() -> Iterator[tuple[SavedQueryType, type[models.Model], str]]:
    for query_type, (app_label, model_name, fk_column) in _TABLES.items():
        yield query_type, apps.get_model(app_label, model_name), fk_column


def db_alias() -> str:
    """
    The database holding both starred tables.
    """
    aliases = {router.db_for_write(model) for _, model, _ in _tables()}
    if len(aliases) != 1:
        raise AssertionError(f"starred query tables span multiple databases: {sorted(aliases)}")
    return aliases.pop()


def lock_starred_list(organization_id: int, user_id: int) -> None:
    """
    Serialize every mutation of one user's starred list, across both tables.
    """
    if not transaction.get_connection(db_alias()).in_atomic_block:
        raise AssertionError("lock_starred_list requires an open transaction on the starred DB")
    digest = hashlib.blake2b(
        f"starred_saved_queries:{organization_id}:{user_id}".encode(), digest_size=8
    ).digest()
    lock_id = int.from_bytes(digest, "big", signed=True)
    with connections[db_alias()].cursor() as cursor:
        cursor.execute("SELECT pg_advisory_xact_lock(%s)", [lock_id])


def next_position(organization: Organization, user_id: int) -> int:
    """
    The position for a star appended to the end of the shared list.

    Caller must hold ``lock_starred_list``.

    This is just the maximum position across both tables, plus one.
    If the user has no starred queries, returns 1.
    """
    highest: int | None = None
    for _, model, _ in _tables():
        value = model.objects.filter(organization=organization, user_id=user_id).aggregate(
            Max("position")
        )["position__max"]
        if value is not None and (highest is None or value > highest):
            highest = value
    return 1 if highest is None else highest + 1


def shift_positions(
    organization: Organization,
    user_id: int,
    *,
    from_position: int,
    delta: int,
    inclusive: bool = False,
) -> None:
    """
    Move every position at or above ``from_position`` by ``delta``, in both tables.

    Caller must hold ``lock_starred_list``.
    """
    lookup = "position__gte" if inclusive else "position__gt"
    for _, model, _ in _tables():
        model.objects.filter(
            **{lookup: from_position}, organization=organization, user_id=user_id
        ).update(position=models.F("position") + delta)


def reorder(organization: Organization, user_id: int, refs: Sequence[SavedQueryRef]) -> None:
    """
    Reassign ``refs`` across the position slots those rows already occupy.

    Caller must hold ``lock_starred_list``.

    Both tables are always read, so ``refs`` has to name every starred query the user has,
    not just those of one product. A payload covering a single product would otherwise be
    accepted and quietly permute that product's queries among the slots it already holds,
    leaving them unable to cross a star belonging to the other product — silently dropping
    part of the reorder the user asked for. Requiring the whole list turns that into an error.

    Raises:
        ValueError: if ``refs`` is not exactly the set of the user's starred rows, or
            contains a duplicate.
    """
    requested = list(refs)
    if len(requested) != len(set(requested)):
        raise ValueError("Single query cannot take up multiple positions.")

    rows: dict[SavedQueryRef, models.Model] = {}
    for query_type, model, fk_column in _tables():
        for row in model.objects.filter(
            organization=organization, user_id=user_id, position__isnull=False, starred=True
        ):
            rows[SavedQueryRef(query_type, getattr(row, fk_column))] = row

    if rows.keys() != set(requested):
        raise ValueError("Mismatch between existing and provided starred queries.")

    slots = sorted(row.position for row in rows.values())

    updates: dict[SavedQueryType, list[models.Model]] = defaultdict(list)
    for ref, position in zip(requested, slots):
        row = rows[ref]
        row.position = position
        updates[ref.type].append(row)

    for query_type, model, _ in _tables():
        if updates[query_type]:
            model.objects.bulk_update(updates[query_type], ["position"])
