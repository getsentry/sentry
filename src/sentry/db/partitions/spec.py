"""
Declarations for Postgres table partitioning.

A model opts in by setting ``__partitioning__`` to a ``RangePartitioning`` or
``HashPartitioning``. The declaration is fixed in code and describes the shape the
table has *when it is partitioned*. Whether a table is actually partitioned in a
given environment is controlled by ``settings.SENTRY_PARTITIONED_TABLES``.
"""

from __future__ import annotations

import enum
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import ClassVar

from django.db.backends.utils import truncate_name

# Postgres truncates identifiers longer than NAMEDATALEN - 1 bytes.
MAX_IDENTIFIER_LENGTH = 63
MAX_HASH_MODULUS = 1024


class PartitionInterval(enum.StrEnum):
    """Width of a range partition. All boundaries are in UTC."""

    DAY = "day"
    # Weeks start on Monday.
    WEEK = "week"
    MONTH = "month"

    def floor(self, value: datetime) -> datetime:
        """Start of the interval containing ``value``."""
        if value.tzinfo is None:
            raise ValueError("Partition boundaries require timezone-aware datetimes.")
        start = value.astimezone(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        if self is PartitionInterval.WEEK:
            return start - timedelta(days=start.weekday())
        if self is PartitionInterval.MONTH:
            return start.replace(day=1)
        return start

    def advance(self, start: datetime, steps: int = 1) -> datetime:
        """Move an interval-aligned ``start`` forward by ``steps`` intervals."""
        if self is PartitionInterval.DAY:
            return start + timedelta(days=steps)
        if self is PartitionInterval.WEEK:
            return start + timedelta(weeks=steps)
        month_index = start.year * 12 + (start.month - 1) + steps
        return start.replace(year=month_index // 12, month=month_index % 12 + 1)


@dataclass(frozen=True)
class RangePartitioning:
    """
    Partition by ranges of a timezone-aware datetime field.

    ``premake`` is how many partitions after the current one are kept created ahead
    of time. ``retention`` is how long partitions are kept before the partition
    maintenance task drops them. ``None`` means partitions are never dropped
    automatically.
    """

    field: str
    interval: PartitionInterval
    premake: int = 4
    retention: timedelta | None = None

    method: ClassVar[str] = "RANGE"


@dataclass(frozen=True)
class HashPartitioning:
    """Partition by the hash of an integer field into ``modulus`` partitions."""

    field: str
    modulus: int

    method: ClassVar[str] = "HASH"


PartitioningSpec = RangePartitioning | HashPartitioning


@dataclass(frozen=True)
class RangePartitionBound:
    name: str
    start: datetime
    end: datetime


@dataclass(frozen=True)
class HashPartitionBound:
    name: str
    modulus: int
    remainder: int


def _with_suffix(table: str, suffix: str) -> str:
    return truncate_name(table, MAX_IDENTIFIER_LENGTH - len(suffix)) + suffix


def range_partition_name(table: str, start: datetime) -> str:
    return _with_suffix(table, f"_p{start.astimezone(UTC):%Y%m%d}")


def hash_partition_name(table: str, modulus: int, remainder: int) -> str:
    width = max(2, len(str(modulus - 1)))
    return _with_suffix(table, f"_h{remainder:0{width}d}")


def range_partition_bounds(
    table: str, interval: PartitionInterval, start: datetime, end: datetime
) -> list[RangePartitionBound]:
    """Partitions covering ``[start, end)``, aligned to ``interval``."""
    bounds = []
    current = interval.floor(start)
    while current < end:
        upper = interval.advance(current)
        bounds.append(RangePartitionBound(range_partition_name(table, current), current, upper))
        current = upper
    return bounds


def premade_range_partition_bounds(
    table: str, spec: RangePartitioning, now: datetime
) -> list[RangePartitionBound]:
    """The partition containing ``now`` plus ``spec.premake`` partitions after it."""
    start = spec.interval.floor(now)
    return range_partition_bounds(
        table, spec.interval, start, spec.interval.advance(start, spec.premake + 1)
    )


def hash_partition_bounds(table: str, modulus: int) -> list[HashPartitionBound]:
    return [
        HashPartitionBound(hash_partition_name(table, modulus, remainder), modulus, remainder)
        for remainder in range(modulus)
    ]
