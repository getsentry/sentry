"""
What the database actually looks like.

Code that behaves differently for partitioned tables reads the Postgres catalog
rather than ``SENTRY_PARTITIONED_TABLES``: the setting only controls how tables are
created, and an environment can change it after its tables exist.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from django.conf import settings
from django.db import connections, models, router
from django.db.backends.base.base import BaseDatabaseWrapper

from sentry.db.partitions import sql
from sentry.db.partitions.registry import (
    get_partition_column,
    is_partitioning_enabled,
    iter_partitioned_models,
)
from sentry.db.partitions.spec import HashPartitioning, RangePartitioning

Strategy = Literal["range", "hash", "list"]
_STRATEGIES: dict[str, Strategy] = {"r": "range", "h": "hash", "l": "list"}
_RANGE_BOUND_RE = re.compile(r"^FOR VALUES FROM \((.+)\) TO \((.+)\)$")


@dataclass(frozen=True)
class PartitionedTableInfo:
    strategy: Strategy
    key_columns: tuple[str, ...]


@dataclass(frozen=True)
class PartitionInfo:
    name: str
    bound: str
    detach_pending: bool

    def range_bounds(self) -> tuple[datetime | None, datetime | None]:
        """Parsed range bounds. ``None`` stands for MINVALUE or MAXVALUE."""
        match = _RANGE_BOUND_RE.match(self.bound)
        if match is None:
            raise ValueError(f"Partition {self.name} has no range bound: {self.bound}")
        return _parse_bound_value(match.group(1)), _parse_bound_value(match.group(2))


def _parse_bound_value(value: str) -> datetime | None:
    if value in ("MINVALUE", "MAXVALUE"):
        return None
    parsed = datetime.fromisoformat(value.strip("'"))
    if parsed.tzinfo is None:
        raise ValueError(f"Range bound {value} is not timezone-aware.")
    return parsed


def get_connection(model: type[models.Model]) -> BaseDatabaseWrapper:
    return connections[router.db_for_write(model)]


def table_exists(connection: BaseDatabaseWrapper, table: str) -> bool:
    with connection.cursor() as cursor:
        cursor.execute(sql.TABLE_EXISTS, [table])
        return bool(cursor.fetchone()[0])


def get_partitioned_table_info(
    connection: BaseDatabaseWrapper, table: str
) -> PartitionedTableInfo | None:
    """``None`` if ``table`` doesn't exist or isn't partitioned."""
    with connection.cursor() as cursor:
        cursor.execute(sql.PARTITIONED_TABLE_INFO, [table])
        row = cursor.fetchone()
    if row is None:
        return None
    strategy, columns = row
    return PartitionedTableInfo(_STRATEGIES[strategy], tuple(columns))


def list_partitions(connection: BaseDatabaseWrapper, table: str) -> list[PartitionInfo]:
    with connection.cursor() as cursor:
        cursor.execute(sql.LIST_PARTITIONS, [table])
        return [PartitionInfo(name, bound, pending) for name, bound, pending in cursor.fetchall()]


def is_partitioned(model: type[models.Model]) -> bool:
    connection = get_connection(model)
    return get_partitioned_table_info(connection, model._meta.db_table) is not None


def verify_partition_state() -> list[str]:
    """
    Differences between declarations, ``SENTRY_PARTITIONED_TABLES`` and the database.

    Tables that don't exist yet are skipped.
    """
    problems = []
    declared_tables = set()
    for model, spec in iter_partitioned_models():
        table = model._meta.db_table
        declared_tables.add(table)
        connection = get_connection(model)
        if not table_exists(connection, table):
            continue
        info = get_partitioned_table_info(connection, table)
        enabled = is_partitioning_enabled(table)
        if enabled and info is None:
            problems.append(f"{table} is in SENTRY_PARTITIONED_TABLES but is not partitioned.")
        elif not enabled and info is not None:
            problems.append(f"{table} is partitioned but is not in SENTRY_PARTITIONED_TABLES.")
        if info is None:
            continue
        expected_strategy = "range" if isinstance(spec, RangePartitioning) else "hash"
        expected_columns = (get_partition_column(model, spec),)
        if info.strategy != expected_strategy or info.key_columns != expected_columns:
            problems.append(
                f"{table} is partitioned by {info.strategy} {info.key_columns}, but its model "
                f"declares {expected_strategy} {expected_columns}."
            )
        if isinstance(spec, HashPartitioning):
            remainders = len(list_partitions(connection, table))
            if remainders != spec.modulus:
                problems.append(
                    f"{table} has {remainders} hash partitions, but its model declares "
                    f"modulus {spec.modulus}."
                )
    for table in sorted(set(settings.SENTRY_PARTITIONED_TABLES) - declared_tables):
        problems.append(
            f"{table} is in SENTRY_PARTITIONED_TABLES but no model declares `__partitioning__`."
        )
    return problems
